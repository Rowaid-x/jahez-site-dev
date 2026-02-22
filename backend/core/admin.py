from django.contrib import admin
from .models import Student, Teacher, Project, Payment


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'email', 'created_at']
    search_fields = ['name', 'phone', 'email']


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ['name', 'expertise', 'phone', 'email', 'created_at']
    search_fields = ['name', 'expertise', 'phone', 'email']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'student', 'teacher', 'status', 'currency', 'total_fee', 'created_at']
    list_filter = ['status']
    search_fields = ['code', 'name', 'student__name', 'teacher__name']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['project', 'month_label', 'scheduled_amount', 'actual_amount', 'due_date', 'status']
    list_filter = ['status']
    search_fields = ['project__code', 'project__student__name']
