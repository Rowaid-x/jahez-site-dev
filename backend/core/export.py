import csv
import json
import codecs
from datetime import date, datetime
from django.http import HttpResponse, JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from .models import Student, Teacher, Project, Payment
from .org_utils import get_user_org


BOM = codecs.BOM_UTF8.decode('utf-8')


def _csv_response(filename):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.write(BOM)
    return response


def _today_str():
    return date.today().strftime('%Y-%m-%d')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_students(request):
    org = get_user_org(request)
    filename = f'jahez_students_{_today_str()}.csv'
    response = _csv_response(filename)
    writer = csv.writer(response)
    writer.writerow(['Name', 'Phone', 'Email', 'Total Projects', 'Total Fees (QAR)', 'Total Paid (QAR)', 'Balance (QAR)'])

    for s in Student.objects.filter(organization=org):
        total_fees = s.projects.aggregate(t=Sum('total_fee'))['t'] or 0
        total_paid = Payment.objects.filter(
            project__student=s, actual_amount__isnull=False
        ).aggregate(t=Sum('actual_amount'))['t'] or 0
        writer.writerow([
            s.name, s.phone, s.email,
            s.projects.count(),
            float(total_fees), float(total_paid),
            float(total_fees) - float(total_paid),
        ])
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_teachers(request):
    org = get_user_org(request)
    filename = f'jahez_teachers_{_today_str()}.csv'
    response = _csv_response(filename)
    writer = csv.writer(response)
    writer.writerow(['Name', 'Expertise', 'Phone', 'Email', 'Total Projects', 'Total Earnings (QAR)', 'Amount Paid (QAR)', 'Amount Unpaid (QAR)'])

    for t in Teacher.objects.filter(organization=org):
        total_earnings = t.projects.aggregate(s=Sum('teacher_fee'))['s'] or 0
        amount_paid = t.projects.filter(teacher_paid=True).aggregate(s=Sum('teacher_fee'))['s'] or 0
        writer.writerow([
            t.name, t.expertise, t.phone, t.email,
            t.projects.count(),
            float(total_earnings), float(amount_paid),
            float(total_earnings) - float(amount_paid),
        ])
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_projects(request):
    org = get_user_org(request)
    filename = f'jahez_projects_{_today_str()}.csv'
    response = _csv_response(filename)
    writer = csv.writer(response)
    writer.writerow([
        'Code', 'Name', 'Student Name', 'Teacher Name', 'Total Fee (QAR)',
        'Monthly Amount (QAR)', 'Total Paid (QAR)', 'Balance (QAR)',
        'Status', 'Teacher Fee (QAR)', 'Teacher Paid',
    ])

    for p in Project.objects.filter(organization=org).select_related('student', 'teacher').prefetch_related('payments'):
        writer.writerow([
            p.code, p.name, p.student.name, p.teacher.name,
            float(p.total_fee), p.monthly_amount, p.total_paid,
            p.remaining_balance, p.status,
            float(p.teacher_fee) if p.teacher_fee else '',
            'Yes' if p.teacher_paid else 'No',
        ])
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_payments(request):
    from_date = request.query_params.get('from')
    to_date = request.query_params.get('to')

    filename = f'jahez_payments_{_today_str()}.csv'
    response = _csv_response(filename)
    writer = csv.writer(response)
    writer.writerow([
        'Project Code', 'Student Name', 'Month', 'Scheduled Amount (QAR)',
        'Paid Amount (QAR)', 'Due Date', 'Status', 'Paid Date',
        'Payment Method', 'Receipt #',
    ])

    org = get_user_org(request)
    qs = Payment.objects.filter(project__organization=org).select_related('project__student')
    if from_date:
        qs = qs.filter(due_date__gte=from_date)
    if to_date:
        qs = qs.filter(due_date__lte=to_date)

    for pay in qs:
        writer.writerow([
            pay.project.code, pay.project.student.name,
            pay.month_label, float(pay.scheduled_amount),
            float(pay.actual_amount) if pay.actual_amount else '',
            pay.due_date.strftime('%Y-%m-%d'), pay.status,
            pay.paid_date.strftime('%Y-%m-%d') if pay.paid_date else '',
            pay.payment_method, pay.receipt_number,
        ])
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_overdue(request):
    filename = f'jahez_overdue_{_today_str()}.csv'
    response = _csv_response(filename)
    writer = csv.writer(response)
    writer.writerow([
        'Student Name', 'Phone', 'Project Code',
        'Amount Due (QAR)', 'Due Date', 'Days Overdue',
    ])

    org = get_user_org(request)
    today = date.today()
    overdue = Payment.objects.filter(
        project__organization=org,
        status__in=['overdue', 'pending', 'partial'],
        due_date__lt=today,
    ).exclude(status='paid').select_related('project__student')

    for pay in overdue:
        already_paid = float(pay.actual_amount or 0)
        amount_due = float(pay.scheduled_amount) - already_paid
        days_overdue = (today - pay.due_date).days
        writer.writerow([
            pay.project.student.name, pay.project.student.phone,
            pay.project.code, amount_due,
            pay.due_date.strftime('%Y-%m-%d'), days_overdue,
        ])
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_teacher_payments(request):
    filename = f'jahez_teacher_payments_{_today_str()}.csv'
    response = _csv_response(filename)
    writer = csv.writer(response)
    writer.writerow([
        'Teacher Name', 'Project Code', 'Student Name',
        'Teacher Fee (QAR)', 'Paid Status', 'Paid Date',
    ])

    org = get_user_org(request)
    projects = Project.objects.filter(organization=org).select_related('student', 'teacher').order_by('teacher__name')
    for p in projects:
        writer.writerow([
            p.teacher.name, p.code, p.student.name,
            float(p.teacher_fee) if p.teacher_fee else '',
            'Paid' if p.teacher_paid else 'Unpaid',
            p.teacher_paid_date.strftime('%Y-%m-%d') if p.teacher_paid_date else '',
        ])
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_backup(request):
    org = get_user_org(request)
    data = {
        'exported_at': datetime.now().isoformat(),
        'students': list(Student.objects.filter(organization=org).values()),
        'teachers': list(Teacher.objects.filter(organization=org).values()),
        'projects': [],
        'payments': [],
    }

    for p in Project.objects.filter(organization=org):
        data['projects'].append({
            'id': p.id, 'code': p.code, 'name': p.name,
            'student_id': p.student_id, 'teacher_id': p.teacher_id,
            'status': p.status, 'total_fee': str(p.total_fee),
            'installment_months': p.installment_months,
            'payment_start_date': str(p.payment_start_date),
            'teacher_fee': str(p.teacher_fee) if p.teacher_fee else None,
            'teacher_paid': p.teacher_paid,
            'teacher_paid_date': str(p.teacher_paid_date) if p.teacher_paid_date else None,
            'notes': p.notes,
            'created_at': p.created_at.isoformat(),
        })

    for pay in Payment.objects.filter(project__organization=org):
        data['payments'].append({
            'id': pay.id, 'project_id': pay.project_id,
            'scheduled_amount': str(pay.scheduled_amount),
            'actual_amount': str(pay.actual_amount) if pay.actual_amount else None,
            'due_date': str(pay.due_date), 'month_label': pay.month_label,
            'status': pay.status,
            'paid_date': str(pay.paid_date) if pay.paid_date else None,
            'payment_method': pay.payment_method,
            'receipt_number': pay.receipt_number,
            'notes': pay.notes,
            'created_at': pay.created_at.isoformat(),
        })

    filename = f'jahez_backup_{_today_str()}.json'
    response = HttpResponse(
        json.dumps(data, ensure_ascii=False, indent=2, default=str),
        content_type='application/json; charset=utf-8',
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
