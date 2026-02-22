from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
import math


CURRENCY_CHOICES = [
    ('QAR', 'QAR - Qatari Riyal'),
    ('USD', 'USD - US Dollar'),
    ('GBP', 'GBP - British Pound'),
    ('JOD', 'JOD - Jordanian Dinar'),
    ('EGP', 'EGP - Egyptian Pound'),
]

# Typical bank exchange rates to QAR
CURRENCY_RATES = {
    'QAR': 1.0,
    'USD': 3.65,
    'GBP': 4.62,
    'JOD': 5.15,
    'EGP': 0.075,
}


class Organization(models.Model):
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='members')

    def __str__(self):
        return f"{self.user.username} @ {self.organization.name}"


class Student(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='students', null=True)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Teacher(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='teachers', null=True)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    expertise = models.CharField(max_length=255, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Project(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('paused', 'Paused'),
        ('cancelled', 'Cancelled'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='projects', null=True)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='projects')
    teacher = models.ForeignKey(Teacher, on_delete=models.PROTECT, related_name='projects')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='QAR')
    fee_in_original = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True,
                                          help_text='Fee in original currency (before conversion to QAR)')
    exchange_rate = models.DecimalField(max_digits=10, decimal_places=4, default=1.0,
                                       help_text='Exchange rate used: 1 original currency = X QAR')
    total_fee = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)],
                                    help_text='Total fee in QAR')
    installment_months = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    payment_start_date = models.DateField()
    teacher_fee = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True,
                                       help_text='Teacher fee in QAR')
    teacher_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='QAR')
    teacher_fee_in_original = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True,
                                                   help_text='Teacher fee in original currency')
    teacher_exchange_rate = models.DecimalField(max_digits=10, decimal_places=4, default=1.0,
                                                help_text='Exchange rate: 1 teacher currency = X QAR')
    teacher_paid = models.BooleanField(default=False)
    teacher_paid_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [['organization', 'code']]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def original_fee_display(self):
        if self.currency != 'QAR' and self.fee_in_original:
            return f"{float(self.fee_in_original):,.2f} {self.currency}"
        return None

    @property
    def teacher_fee_display(self):
        if self.teacher_currency != 'QAR' and self.teacher_fee_in_original:
            return f"{float(self.teacher_fee_in_original):,.2f} {self.teacher_currency}"
        return None

    @property
    def monthly_amount(self):
        return math.ceil(float(self.total_fee) / self.installment_months)

    @property
    def total_paid(self):
        return sum(
            float(p.actual_amount) for p in self.payments.all() if p.actual_amount is not None
        )

    @property
    def remaining_balance(self):
        return float(self.total_fee) - self.total_paid

    @property
    def payment_status(self):
        from datetime import date
        payments = self.payments.all()
        if not payments:
            return 'pending'
        total_paid = self.total_paid
        if total_paid >= float(self.total_fee):
            return 'fully_paid'
        has_overdue = any(
            p.status != 'paid' and p.due_date < date.today() for p in payments
        )
        if has_overdue:
            return 'overdue'
        if total_paid > 0:
            return 'partial'
        return 'on_track'


DURATION_CHOICES = [
    (1.0, '1 Hour'),
    (1.5, '1.5 Hours'),
    (2.0, '2 Hours'),
    (2.5, '2.5 Hours'),
    (3.0, '3 Hours'),
]


class PrivateClass(models.Model):
    STUDENT_PAYMENT_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
    ]
    TEACHER_PAYMENT_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='private_classes', null=True)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='private_classes')
    teacher = models.ForeignKey(Teacher, on_delete=models.PROTECT, related_name='private_classes')
    date = models.DateField()
    duration = models.DecimalField(max_digits=3, decimal_places=1, validators=[MinValueValidator(0.5)],
                                   help_text='Duration in hours (e.g. 1.0, 1.5, 2.0)')
    student_hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0.01)],
                                              help_text='Rate charged to student per hour (in student_currency)')
    student_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='QAR')
    teacher_hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0.01)],
                                              help_text='Rate paid to teacher per hour (in teacher_currency)')
    teacher_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='QAR')
    student_payment_status = models.CharField(max_length=20, choices=STUDENT_PAYMENT_CHOICES, default='pending')
    student_paid_date = models.DateField(null=True, blank=True)
    teacher_payment_status = models.CharField(max_length=20, choices=TEACHER_PAYMENT_CHOICES, default='pending')
    teacher_paid_date = models.DateField(null=True, blank=True)
    subject = models.CharField(max_length=255, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.student.name} - {self.teacher.name} - {self.date}"

    @property
    def student_total(self):
        return float(self.student_hourly_rate) * float(self.duration)

    @property
    def teacher_total(self):
        return float(self.teacher_hourly_rate) * float(self.duration)

    @property
    def student_total_qar(self):
        rate = CURRENCY_RATES.get(self.student_currency, 1.0)
        return round(self.student_total * rate, 2)

    @property
    def teacher_total_qar(self):
        rate = CURRENCY_RATES.get(self.teacher_currency, 1.0)
        return round(self.teacher_total * rate, 2)

    @property
    def profit(self):
        return round(self.student_total_qar - self.teacher_total_qar, 2)


class ClassPayment(models.Model):
    """Payment made by a student for private class sessions."""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='class_payments', null=True)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='class_payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='QAR')
    amount_qar = models.DecimalField(max_digits=12, decimal_places=2,
                                      help_text='Amount in QAR (auto-calculated)')
    paid_date = models.DateField()
    payment_method = models.CharField(max_length=50, blank=True, default='')
    receipt_number = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    classes = models.ManyToManyField(PrivateClass, blank=True, related_name='class_payments',
                                     help_text='Classes covered by this payment')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-paid_date', '-created_at']

    def __str__(self):
        return f"{self.student.name} - {self.amount} {self.currency} - {self.paid_date}"

    def save(self, *args, **kwargs):
        if not self.amount_qar:
            rate = CURRENCY_RATES.get(self.currency, 1.0)
            self.amount_qar = round(float(self.amount) * rate, 2)
        super().save(*args, **kwargs)


class Payment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('partial', 'Partial'),
        ('overdue', 'Overdue'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='payments')
    scheduled_amount = models.DecimalField(max_digits=12, decimal_places=2)
    actual_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    due_date = models.DateField()
    month_label = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    paid_date = models.DateField(null=True, blank=True)
    payment_method = models.CharField(max_length=50, blank=True, default='')
    receipt_number = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['due_date']

    def __str__(self):
        return f"{self.project.code} - {self.month_label} - {self.status}"
