from django.contrib import admin
from .models import Organization, UserProfile, Student, Teacher, Project, Payment, PrivateClass


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'organization']
    list_filter = ['organization']


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'email', 'organization', 'created_at']
    list_filter = ['organization']
    search_fields = ['name', 'phone', 'email']


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ['name', 'expertise', 'phone', 'email', 'organization', 'created_at']
    list_filter = ['organization']
    search_fields = ['name', 'expertise', 'phone', 'email']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'student', 'teacher', 'status', 'currency', 'total_fee', 'organization', 'created_at']
    list_filter = ['status', 'organization']
    search_fields = ['code', 'name', 'student__name', 'teacher__name']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['project', 'month_label', 'scheduled_amount', 'actual_amount', 'due_date', 'status']
    list_filter = ['status']
    search_fields = ['project__code', 'project__student__name']


@admin.register(PrivateClass)
class PrivateClassAdmin(admin.ModelAdmin):
    list_display = ['student', 'teacher', 'date', 'duration', 'subject', 'student_payment_status', 'teacher_payment_status', 'organization']
    list_filter = ['student_payment_status', 'teacher_payment_status', 'teacher', 'organization']
    search_fields = ['student__name', 'teacher__name', 'subject']
