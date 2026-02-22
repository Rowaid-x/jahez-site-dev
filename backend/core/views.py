from rest_framework import viewsets, status, filters
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count, Q, F
from django.utils import timezone
from datetime import date
from django_filters.rest_framework import DjangoFilterBackend

from .models import Student, Teacher, Project, Payment, PrivateClass, CURRENCY_CHOICES, CURRENCY_RATES
from .serializers import (
    StudentSerializer, StudentDetailSerializer, StudentCreateSerializer,
    TeacherSerializer, TeacherDetailSerializer, TeacherCreateSerializer,
    ProjectListSerializer, ProjectDetailSerializer, ProjectCreateSerializer,
    PaymentSerializer, PaymentUpdateSerializer,
    RecordPaymentSerializer, PreviewPaymentSerializer,
    PrivateClassListSerializer, PrivateClassCreateSerializer,
)
from .payment_logic import (
    generate_installments, regenerate_installments,
    apply_payment, preview_payment, update_overdue_statuses,
)


class StudentViewSet(viewsets.ModelViewSet):
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


class TeacherViewSet(viewsets.ModelViewSet):
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


class ProjectViewSet(viewsets.ModelViewSet):
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
        project = serializer.save()
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


class PaymentViewSet(viewsets.ModelViewSet):
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

    try:
        project = Project.objects.get(id=serializer.validated_data['project_id'])
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

    try:
        project = Project.objects.get(id=serializer.validated_data['project_id'])
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

    result = preview_payment(project, serializer.validated_data['amount'])
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def overdue_payments(request):
    update_overdue_statuses()
    payments = Payment.objects.filter(
        status='overdue'
    ).select_related('project__student', 'project__teacher').order_by('due_date')

    serializer = PaymentSerializer(payments, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    update_overdue_statuses()

    total_students = Student.objects.count()
    total_teachers = Teacher.objects.count()
    active_projects = Project.objects.filter(status='active').count()

    total_revenue = Project.objects.aggregate(total=Sum('total_fee'))['total'] or 0
    total_collected = Payment.objects.filter(
        actual_amount__isnull=False,
    ).aggregate(total=Sum('actual_amount'))['total'] or 0
    total_pending = float(total_revenue) - float(total_collected)
    overdue_count = Payment.objects.filter(status='overdue').count()

    # Monthly collection data for chart
    from django.db.models.functions import TruncMonth
    monthly_data = (
        Payment.objects.filter(actual_amount__isnull=False)
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
        actual_amount__isnull=False,
    ).select_related('project__student').order_by('-paid_date', '-created_at')[:10]
    recent_data = PaymentSerializer(recent_payments, many=True).data

    # Upcoming dues
    upcoming = Payment.objects.filter(
        status__in=['pending', 'partial'],
        due_date__gte=date.today(),
    ).select_related('project__student').order_by('due_date')[:5]
    upcoming_data = PaymentSerializer(upcoming, many=True).data

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
    })


class PrivateClassViewSet(viewsets.ModelViewSet):
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def currencies(request):
    data = [
        {'code': code, 'name': label, 'rate': CURRENCY_RATES.get(code, 1.0)}
        for code, label in CURRENCY_CHOICES
    ]
    return Response(data)
