from rest_framework import serializers
from .models import Student, Teacher, Project, Payment, PrivateClass, ClassPayment, CURRENCY_CHOICES, CURRENCY_RATES
from django.db.models import Sum, Count, Q
from decimal import Decimal


class StudentSerializer(serializers.ModelSerializer):
    total_projects = serializers.SerializerMethodField()
    total_fees = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    total_classes = serializers.SerializerMethodField()
    classes_revenue_qar = serializers.SerializerMethodField()
    classes_collected_qar = serializers.SerializerMethodField()
    classes_balance = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'name', 'phone', 'email', 'notes', 'created_at',
            'total_projects', 'total_fees', 'total_paid', 'balance',
            'total_classes', 'classes_revenue_qar', 'classes_collected_qar', 'classes_balance',
        ]

    def get_total_projects(self, obj):
        return obj.projects.count()

    def get_total_fees(self, obj):
        result = obj.projects.aggregate(total=Sum('total_fee'))
        return float(result['total'] or 0)

    def get_total_paid(self, obj):
        result = Payment.objects.filter(
            project__student=obj,
            actual_amount__isnull=False,
        ).aggregate(total=Sum('actual_amount'))
        return float(result['total'] or 0)

    def get_balance(self, obj):
        return self.get_total_fees(obj) - self.get_total_paid(obj)

    def get_total_classes(self, obj):
        return obj.private_classes.count()

    def get_classes_revenue_qar(self, obj):
        total = 0
        for pc in obj.private_classes.all():
            total += pc.student_total_qar
        return round(total, 2)

    def get_classes_collected_qar(self, obj):
        result = obj.class_payments.aggregate(total=Sum('amount_qar'))
        return float(result['total'] or 0)

    def get_classes_balance(self, obj):
        return round(self.get_classes_revenue_qar(obj) - self.get_classes_collected_qar(obj), 2)


class ProjectMinimalSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.name', read_only=True)
    monthly_amount = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    remaining_balance = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    original_fee_display = serializers.SerializerMethodField()
    teacher_fee_display = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'status', 'total_fee',
            'currency', 'fee_in_original', 'exchange_rate', 'original_fee_display',
            'teacher_fee', 'teacher_currency', 'teacher_fee_in_original',
            'teacher_exchange_rate', 'teacher_fee_display',
            'teacher_paid', 'student_name', 'teacher_name',
            'monthly_amount', 'total_paid', 'remaining_balance', 'payment_status',
        ]

    def get_monthly_amount(self, obj):
        return obj.monthly_amount

    def get_total_paid(self, obj):
        return obj.total_paid

    def get_remaining_balance(self, obj):
        return obj.remaining_balance

    def get_payment_status(self, obj):
        return obj.payment_status

    def get_original_fee_display(self, obj):
        return obj.original_fee_display

    def get_teacher_fee_display(self, obj):
        return obj.teacher_fee_display


class PrivateClassMinimalSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.name', read_only=True)
    student_total = serializers.SerializerMethodField()
    teacher_total = serializers.SerializerMethodField()
    student_total_qar = serializers.SerializerMethodField()
    teacher_total_qar = serializers.SerializerMethodField()

    class Meta:
        model = PrivateClass
        fields = [
            'id', 'date', 'duration', 'subject', 'teacher_name',
            'student_hourly_rate', 'student_currency',
            'teacher_hourly_rate', 'teacher_currency',
            'student_total', 'teacher_total',
            'student_total_qar', 'teacher_total_qar',
            'student_payment_status', 'teacher_payment_status',
        ]

    def get_student_total(self, obj):
        return obj.student_total

    def get_teacher_total(self, obj):
        return obj.teacher_total

    def get_student_total_qar(self, obj):
        return obj.student_total_qar

    def get_teacher_total_qar(self, obj):
        return obj.teacher_total_qar


class StudentDetailSerializer(StudentSerializer):
    projects = ProjectMinimalSerializer(many=True, read_only=True)
    private_classes = PrivateClassMinimalSerializer(many=True, read_only=True)

    class Meta(StudentSerializer.Meta):
        fields = StudentSerializer.Meta.fields + ['projects', 'private_classes']


class StudentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['id', 'name', 'phone', 'email', 'notes']


class TeacherSerializer(serializers.ModelSerializer):
    total_projects = serializers.SerializerMethodField()
    total_earnings = serializers.SerializerMethodField()
    amount_paid = serializers.SerializerMethodField()
    amount_unpaid = serializers.SerializerMethodField()
    total_classes = serializers.SerializerMethodField()
    classes_cost_qar = serializers.SerializerMethodField()
    classes_paid_count = serializers.SerializerMethodField()
    classes_unpaid_count = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            'id', 'name', 'phone', 'email', 'expertise', 'notes', 'created_at',
            'total_projects', 'total_earnings', 'amount_paid', 'amount_unpaid',
            'total_classes', 'classes_cost_qar', 'classes_paid_count', 'classes_unpaid_count',
        ]

    def get_total_projects(self, obj):
        return obj.projects.count()

    def get_total_earnings(self, obj):
        result = obj.projects.aggregate(total=Sum('teacher_fee'))
        return float(result['total'] or 0)

    def get_amount_paid(self, obj):
        result = obj.projects.filter(teacher_paid=True).aggregate(total=Sum('teacher_fee'))
        return float(result['total'] or 0)

    def get_amount_unpaid(self, obj):
        return self.get_total_earnings(obj) - self.get_amount_paid(obj)

    def get_total_classes(self, obj):
        return obj.private_classes.count()

    def get_classes_cost_qar(self, obj):
        total = 0
        for pc in obj.private_classes.all():
            total += pc.teacher_total_qar
        return round(total, 2)

    def get_classes_paid_count(self, obj):
        return obj.private_classes.filter(teacher_payment_status='paid').count()

    def get_classes_unpaid_count(self, obj):
        return obj.private_classes.filter(teacher_payment_status='pending').count()


class TeacherDetailSerializer(TeacherSerializer):
    projects = ProjectMinimalSerializer(many=True, read_only=True)
    private_classes = PrivateClassMinimalSerializer(many=True, read_only=True)

    class Meta(TeacherSerializer.Meta):
        fields = TeacherSerializer.Meta.fields + ['projects', 'private_classes']


class TeacherCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = ['id', 'name', 'phone', 'email', 'expertise', 'notes']


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='project.student.name', read_only=True)
    project_code = serializers.CharField(source='project.code', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'project', 'project_code', 'student_name',
            'scheduled_amount', 'actual_amount', 'due_date', 'month_label',
            'status', 'paid_date', 'payment_method', 'receipt_number',
            'notes', 'created_at',
        ]


class PaymentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'actual_amount', 'status', 'paid_date',
            'payment_method', 'receipt_number', 'notes',
        ]


class ProjectListSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.name', read_only=True)
    monthly_amount = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    remaining_balance = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    original_fee_display = serializers.SerializerMethodField()
    teacher_fee_display = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'student', 'student_name',
            'teacher', 'teacher_name', 'status',
            'currency', 'fee_in_original', 'exchange_rate', 'original_fee_display',
            'total_fee', 'installment_months', 'payment_start_date',
            'teacher_fee', 'teacher_currency', 'teacher_fee_in_original',
            'teacher_exchange_rate', 'teacher_fee_display',
            'teacher_paid', 'teacher_paid_date',
            'notes', 'created_at',
            'monthly_amount', 'total_paid', 'remaining_balance', 'payment_status',
        ]

    def get_monthly_amount(self, obj):
        return obj.monthly_amount

    def get_total_paid(self, obj):
        return obj.total_paid

    def get_remaining_balance(self, obj):
        return obj.remaining_balance

    def get_payment_status(self, obj):
        return obj.payment_status

    def get_original_fee_display(self, obj):
        return obj.original_fee_display

    def get_teacher_fee_display(self, obj):
        return obj.teacher_fee_display


class ProjectDetailSerializer(ProjectListSerializer):
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + ['payments']


class ProjectCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'student', 'teacher', 'status',
            'currency', 'fee_in_original', 'exchange_rate',
            'total_fee', 'installment_months', 'payment_start_date',
            'teacher_fee', 'teacher_currency', 'teacher_fee_in_original',
            'teacher_exchange_rate', 'notes',
        ]

    def validate_code(self, value):
        request = self.context.get('request')
        qs = Project.objects.filter(code=value).exclude(pk=self.instance.pk if self.instance else None)
        if request and hasattr(request.user, 'profile'):
            qs = qs.filter(organization=request.user.profile.organization)
        if qs.exists():
            raise serializers.ValidationError("A project with this code already exists.")
        return value


class RecordPaymentSerializer(serializers.Serializer):
    project_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    payment_method = serializers.CharField(required=False, default='', allow_blank=True)
    receipt_number = serializers.CharField(required=False, default='', allow_blank=True)
    notes = serializers.CharField(required=False, default='', allow_blank=True)


class PreviewPaymentSerializer(serializers.Serializer):
    project_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))


class PrivateClassListSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.name', read_only=True)
    student_total = serializers.SerializerMethodField()
    teacher_total = serializers.SerializerMethodField()
    student_total_qar = serializers.SerializerMethodField()
    teacher_total_qar = serializers.SerializerMethodField()
    profit = serializers.SerializerMethodField()

    class Meta:
        model = PrivateClass
        fields = [
            'id', 'student', 'student_name', 'teacher', 'teacher_name',
            'date', 'duration', 'subject',
            'student_hourly_rate', 'student_currency',
            'teacher_hourly_rate', 'teacher_currency',
            'student_total', 'teacher_total',
            'student_total_qar', 'teacher_total_qar', 'profit',
            'student_payment_status', 'student_paid_date',
            'teacher_payment_status', 'teacher_paid_date',
            'notes', 'created_at',
        ]

    def get_student_total(self, obj):
        return obj.student_total

    def get_teacher_total(self, obj):
        return obj.teacher_total

    def get_student_total_qar(self, obj):
        return obj.student_total_qar

    def get_teacher_total_qar(self, obj):
        return obj.teacher_total_qar

    def get_profit(self, obj):
        return obj.profit


class PrivateClassCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivateClass
        fields = [
            'id', 'student', 'teacher', 'date', 'duration', 'subject',
            'student_hourly_rate', 'student_currency',
            'teacher_hourly_rate', 'teacher_currency',
            'student_payment_status', 'student_paid_date',
            'teacher_payment_status', 'teacher_paid_date',
            'notes',
        ]


class ClassPaymentListSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    classes_count = serializers.SerializerMethodField()

    class Meta:
        model = ClassPayment
        fields = [
            'id', 'student', 'student_name', 'amount', 'currency', 'amount_qar',
            'paid_date', 'payment_method', 'receipt_number', 'notes',
            'classes', 'classes_count', 'created_at',
        ]

    def get_classes_count(self, obj):
        return obj.classes.count()


class ClassPaymentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassPayment
        fields = [
            'id', 'student', 'amount', 'currency', 'amount_qar',
            'paid_date', 'payment_method', 'receipt_number', 'notes',
            'classes',
        ]

    def validate(self, data):
        # Auto-calculate amount_qar if not provided
        if not data.get('amount_qar'):
            currency = data.get('currency', 'QAR')
            rate = CURRENCY_RATES.get(currency, 1.0)
            data['amount_qar'] = round(float(data['amount']) * rate, 2)
        return data
