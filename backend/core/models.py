from django.db import models
from django.core.validators import MinValueValidator
import math


class Student(models.Model):
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

    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='projects')
    teacher = models.ForeignKey(Teacher, on_delete=models.PROTECT, related_name='projects')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    total_fee = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    installment_months = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    payment_start_date = models.DateField()
    teacher_fee = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    teacher_paid = models.BooleanField(default=False)
    teacher_paid_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} - {self.name}"

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
