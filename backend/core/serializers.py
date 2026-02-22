from rest_framework import serializers
from .models import Student, Teacher, Project, Payment, CURRENCY_CHOICES, CURRENCY_RATES
from django.db.models import Sum, Count, Q
from decimal import Decimal


class StudentSerializer(serializers.ModelSerializer):
    total_projects = serializers.SerializerMethodField()
    total_fees = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'name', 'phone', 'email', 'notes', 'created_at',
            'total_projects', 'total_fees', 'total_paid', 'balance',
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


class ProjectMinimalSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.name', read_only=True)
    monthly_amount = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    remaining_balance = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    original_fee_display = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'status', 'total_fee',
            'currency', 'fee_in_original', 'exchange_rate', 'original_fee_display',
            'teacher_fee', 'teacher_paid', 'student_name', 'teacher_name',
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


class StudentDetailSerializer(StudentSerializer):
    projects = ProjectMinimalSerializer(many=True, read_only=True)

    class Meta(StudentSerializer.Meta):
        fields = StudentSerializer.Meta.fields + ['projects']


class StudentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['id', 'name', 'phone', 'email', 'notes']


class TeacherSerializer(serializers.ModelSerializer):
    total_projects = serializers.SerializerMethodField()
    total_earnings = serializers.SerializerMethodField()
    amount_paid = serializers.SerializerMethodField()
    amount_unpaid = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            'id', 'name', 'phone', 'email', 'expertise', 'notes', 'created_at',
            'total_projects', 'total_earnings', 'amount_paid', 'amount_unpaid',
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


class TeacherDetailSerializer(TeacherSerializer):
    projects = ProjectMinimalSerializer(many=True, read_only=True)

    class Meta(TeacherSerializer.Meta):
        fields = TeacherSerializer.Meta.fields + ['projects']


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

    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'student', 'student_name',
            'teacher', 'teacher_name', 'status',
            'currency', 'fee_in_original', 'exchange_rate', 'original_fee_display',
            'total_fee', 'installment_months', 'payment_start_date',
            'teacher_fee', 'teacher_paid', 'teacher_paid_date',
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
            'teacher_fee', 'notes',
        ]

    def validate_code(self, value):
        if Project.objects.filter(code=value).exclude(pk=self.instance.pk if self.instance else None).exists():
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
