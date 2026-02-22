from rest_framework import viewsets, status, filters
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count, Q, F
from django.utils import timezone
from datetime import date
from django_filters.rest_framework import DjangoFilterBackend

from .models import Student, Teacher, Project, Payment, PrivateClass, ClassPayment, CURRENCY_CHOICES, CURRENCY_RATES
from .org_utils import get_user_org, OrgQuerySetMixin, OrgPaymentQuerySetMixin
from .serializers import (
    StudentSerializer, StudentDetailSerializer, StudentCreateSerializer,
    TeacherSerializer, TeacherDetailSerializer, TeacherCreateSerializer,
    ProjectListSerializer, ProjectDetailSerializer, ProjectCreateSerializer,
    PaymentSerializer, PaymentUpdateSerializer,
    RecordPaymentSerializer, PreviewPaymentSerializer,
    PrivateClassListSerializer, PrivateClassCreateSerializer,
    ClassPaymentListSerializer, ClassPaymentCreateSerializer,
)
from .payment_logic import (
    generate_installments, regenerate_installments,
    apply_payment, preview_payment, update_overdue_statuses,
)


class StudentViewSet(OrgQuerySetMixin, viewsets.ModelViewSet):
    queryset = Student.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'phone', 'email']
    ordering_fields = ['name', 'created_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StudentCreateSerializer
        if self.action == 'retrieve':
            return StudentDetailSerializer
        return StudentSerializer

    def destroy(self, request, *args, **kwargs):
        student = self.get_object()
        if student.projects.exists():
            return Response(
                {'error': 'Cannot delete a student who has projects. Remove their projects first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class TeacherViewSet(OrgQuerySetMixin, viewsets.ModelViewSet):
    queryset = Teacher.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'phone', 'email', 'expertise']
    ordering_fields = ['name', 'created_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TeacherCreateSerializer
        if self.action == 'retrieve':
            return TeacherDetailSerializer
        return TeacherSerializer

    def destroy(self, request, *args, **kwargs):
        teacher = self.get_object()
        if teacher.projects.filter(status='active').exists():
            return Response(
                {'error': 'Cannot delete a teacher who has active projects.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class ProjectViewSet(OrgQuerySetMixin, viewsets.ModelViewSet):
    queryset = Project.objects.select_related('student', 'teacher').prefetch_related('payments').all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'student', 'teacher']
    search_fields = ['code', 'name', 'student__name', 'teacher__name']
    ordering_fields = ['code', 'created_at', 'total_fee']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProjectDetailSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return ProjectCreateSerializer
        return ProjectListSerializer

    def perform_create(self, serializer):
        org = get_user_org(self.request)
        project = serializer.save(organization=org)
        generate_installments(project)

    def perform_update(self, serializer):
        old_project = self.get_object()
        old_fee = old_project.total_fee
        old_months = old_project.installment_months
        project = serializer.save()
        if project.total_fee != old_fee or project.installment_months != old_months:
            regenerate_installments(project)

    def destroy(self, request, *args, **kwargs):
        project = self.get_object()
        if project.payments.filter(status='paid').exists():
            return Response(
                {'error': 'Cannot delete a project that has recorded payments.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def mark_teacher_paid(self, request, pk=None):
        project = self.get_object()
        paid_date = request.data.get('paid_date', str(date.today()))
        project.teacher_paid = True
        project.teacher_paid_date = paid_date
        project.save()
        return Response({'status': 'Teacher marked as paid', 'paid_date': paid_date})

    @action(detail=True, methods=['post'])
    def mark_teacher_unpaid(self, request, pk=None):
        project = self.get_object()
        project.teacher_paid = False
        project.teacher_paid_date = None
        project.save()
        return Response({'status': 'Teacher marked as unpaid'})


class PaymentViewSet(OrgPaymentQuerySetMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('project__student', 'project__teacher').all()
    serializer_class = PaymentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'project', 'project__student', 'project__teacher']
    search_fields = ['project__code', 'project__student__name', 'month_label']
    ordering_fields = ['due_date', 'created_at']

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return PaymentUpdateSerializer
        return PaymentSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def record_payment(request):
    serializer = RecordPaymentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    org = get_user_org(request)
    try:
        project = Project.objects.get(id=serializer.validated_data['project_id'], organization=org)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    result = apply_payment(
        project,
        serializer.validated_data['amount'],
        payment_method=serializer.validated_data.get('payment_method', ''),
        receipt_number=serializer.validated_data.get('receipt_number', ''),
        notes=serializer.validated_data.get('notes', ''),
    )
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def preview_payment_view(request):
    serializer = PreviewPaymentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    org = get_user_org(request)
    try:
        project = Project.objects.get(id=serializer.validated_data['project_id'], organization=org)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    result = preview_payment(project, serializer.validated_data['amount'])
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def overdue_payments(request):
    org = get_user_org(request)
    update_overdue_statuses(org)
    payments = Payment.objects.filter(
        status='overdue', project__organization=org
    ).select_related('project__student', 'project__teacher').order_by('due_date')

    serializer = PaymentSerializer(payments, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    org = get_user_org(request)
    update_overdue_statuses(org)

    total_students = Student.objects.filter(organization=org).count()
    total_teachers = Teacher.objects.filter(organization=org).count()
    active_projects = Project.objects.filter(organization=org, status='active').count()

    total_revenue = Project.objects.filter(organization=org).aggregate(total=Sum('total_fee'))['total'] or 0
    total_collected = Payment.objects.filter(
        project__organization=org, actual_amount__isnull=False,
    ).aggregate(total=Sum('actual_amount'))['total'] or 0
    total_pending = float(total_revenue) - float(total_collected)
    overdue_count = Payment.objects.filter(project__organization=org, status='overdue').count()

    # Monthly collection data for chart
    from django.db.models.functions import TruncMonth
    monthly_data = (
        Payment.objects.filter(project__organization=org, actual_amount__isnull=False)
        .annotate(month=TruncMonth('paid_date'))
        .values('month')
        .annotate(total=Sum('actual_amount'))
        .order_by('month')
    )
    monthly_collections = [
        {'month': item['month'].strftime('%b %Y') if item['month'] else 'Unknown', 'total': float(item['total'])}
        for item in monthly_data if item['month']
    ]

    # Recent payments
    recent_payments = Payment.objects.filter(
        project__organization=org, actual_amount__isnull=False,
    ).select_related('project__student').order_by('-paid_date', '-created_at')[:10]
    recent_data = PaymentSerializer(recent_payments, many=True).data

    # Upcoming dues
    upcoming = Payment.objects.filter(
        project__organization=org,
        status__in=['pending', 'partial'],
        due_date__gte=date.today(),
    ).select_related('project__student').order_by('due_date')[:5]
    upcoming_data = PaymentSerializer(upcoming, many=True).data

    # --- Private Classes stats ---
    org_classes = PrivateClass.objects.filter(organization=org)
    total_classes = org_classes.count()
    classes_student_revenue_qar = 0
    classes_teacher_cost_qar = 0
    classes_profit_qar = 0
    for pc in org_classes:
        classes_student_revenue_qar += pc.student_total_qar
        classes_teacher_cost_qar += pc.teacher_total_qar
        classes_profit_qar += pc.profit
    classes_student_unpaid = org_classes.filter(student_payment_status='pending').count()
    classes_teacher_unpaid = org_classes.filter(teacher_payment_status='pending').count()

    # Class payments collected
    classes_collected_qar = float(
        ClassPayment.objects.filter(organization=org).aggregate(total=Sum('amount_qar'))['total'] or 0
    )
    classes_outstanding_qar = round(classes_student_revenue_qar - classes_collected_qar, 2)

    # Monthly class payments for chart
    monthly_class_data = (
        ClassPayment.objects.filter(organization=org)
        .annotate(month=TruncMonth('paid_date'))
        .values('month')
        .annotate(total=Sum('amount_qar'))
        .order_by('month')
    )
    monthly_class_collections = [
        {'month': item['month'].strftime('%b %Y') if item['month'] else 'Unknown', 'total': float(item['total'])}
        for item in monthly_class_data if item['month']
    ]

    # Recent class payments
    recent_class_payments = ClassPayment.objects.filter(
        organization=org,
    ).select_related('student').order_by('-paid_date', '-created_at')[:10]
    recent_class_data = [
        {
            'id': cp.id,
            'student_name': cp.student.name,
            'amount': float(cp.amount),
            'currency': cp.currency,
            'amount_qar': float(cp.amount_qar),
            'paid_date': str(cp.paid_date),
            'classes_count': cp.classes.count(),
        }
        for cp in recent_class_payments
    ]

    return Response({
        'total_students': total_students,
        'total_teachers': total_teachers,
        'active_projects': active_projects,
        'total_revenue': float(total_revenue),
        'total_collected': float(total_collected),
        'total_pending': total_pending,
        'overdue_count': overdue_count,
        'monthly_collections': monthly_collections,
        'recent_payments': recent_data,
        'upcoming_dues': upcoming_data,
        'collection_rate': round(float(total_collected) / float(total_revenue) * 100, 1) if total_revenue else 0,
        # Private classes
        'total_classes': total_classes,
        'classes_student_revenue': round(classes_student_revenue_qar, 2),
        'classes_teacher_cost': round(classes_teacher_cost_qar, 2),
        'classes_profit': round(classes_profit_qar, 2),
        'classes_collected': classes_collected_qar,
        'classes_outstanding': classes_outstanding_qar,
        'classes_student_unpaid': classes_student_unpaid,
        'classes_teacher_unpaid': classes_teacher_unpaid,
        'monthly_class_collections': monthly_class_collections,
        'recent_class_payments': recent_class_data,
    })


class PrivateClassViewSet(OrgQuerySetMixin, viewsets.ModelViewSet):
    queryset = PrivateClass.objects.select_related('student', 'teacher').all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['student', 'teacher', 'student_payment_status', 'teacher_payment_status']
    search_fields = ['student__name', 'teacher__name', 'subject']
    ordering_fields = ['date', 'created_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PrivateClassCreateSerializer
        return PrivateClassListSerializer

    @action(detail=True, methods=['post'])
    def mark_student_paid(self, request, pk=None):
        obj = self.get_object()
        paid_date = request.data.get('paid_date', str(date.today()))
        obj.student_payment_status = 'paid'
        obj.student_paid_date = paid_date
        obj.save()
        return Response({'status': 'Student payment marked as paid', 'paid_date': paid_date})

    @action(detail=True, methods=['post'])
    def mark_student_unpaid(self, request, pk=None):
        obj = self.get_object()
        obj.student_payment_status = 'pending'
        obj.student_paid_date = None
        obj.save()
        return Response({'status': 'Student payment marked as unpaid'})

    @action(detail=True, methods=['post'])
    def mark_teacher_paid(self, request, pk=None):
        obj = self.get_object()
        paid_date = request.data.get('paid_date', str(date.today()))
        obj.teacher_payment_status = 'paid'
        obj.teacher_paid_date = paid_date
        obj.save()
        return Response({'status': 'Teacher payment marked as paid', 'paid_date': paid_date})

    @action(detail=True, methods=['post'])
    def mark_teacher_unpaid(self, request, pk=None):
        obj = self.get_object()
        obj.teacher_payment_status = 'pending'
        obj.teacher_paid_date = None
        obj.save()
        return Response({'status': 'Teacher payment marked as unpaid'})


class ClassPaymentViewSet(OrgQuerySetMixin, viewsets.ModelViewSet):
    queryset = ClassPayment.objects.select_related('student').prefetch_related('classes').all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['student']
    search_fields = ['student__name', 'notes', 'receipt_number']
    ordering_fields = ['paid_date', 'created_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ClassPaymentCreateSerializer
        return ClassPaymentListSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def currencies(request):
    data = [
        {'code': code, 'name': label, 'rate': CURRENCY_RATES.get(code, 1.0)}
        for code, label in CURRENCY_CHOICES
    ]
    return Response(data)
