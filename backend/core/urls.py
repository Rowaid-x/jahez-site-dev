from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import export

router = DefaultRouter()
router.register(r'students', views.StudentViewSet)
router.register(r'teachers', views.TeacherViewSet)
router.register(r'projects', views.ProjectViewSet)
router.register(r'payments', views.PaymentViewSet)

urlpatterns = [
    # Manual routes first (before router to avoid conflicts)
    path('payments/record/', views.record_payment, name='record-payment'),
    path('payments/preview/', views.preview_payment_view, name='preview-payment'),
    path('payments/overdue/', views.overdue_payments, name='overdue-payments'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('currencies/', views.currencies, name='currencies'),
    # Export endpoints
    path('export/students/', export.export_students, name='export-students'),
    path('export/teachers/', export.export_teachers, name='export-teachers'),
    path('export/projects/', export.export_projects, name='export-projects'),
    path('export/payments/', export.export_payments, name='export-payments'),
    path('export/overdue/', export.export_overdue, name='export-overdue'),
    path('export/teacher-payments/', export.export_teacher_payments, name='export-teacher-payments'),
    path('export/backup/', export.export_backup, name='export-backup'),
    # Router (viewsets)
    path('', include(router.urls)),
]
