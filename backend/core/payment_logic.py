from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
import math
from decimal import Decimal


def generate_installments(project):
    """Generate payment installments for a project."""
    from .models import Payment

    monthly_amount = math.ceil(float(project.total_fee) / project.installment_months)
    remaining_fee = float(project.total_fee)
    payments = []

    for i in range(project.installment_months):
        due_date = project.payment_start_date + relativedelta(months=i)
        scheduled = min(monthly_amount, remaining_fee)
        remaining_fee -= scheduled

        month_label = due_date.strftime('%b %Y')

        payment = Payment(
            project=project,
            scheduled_amount=Decimal(str(scheduled)),
            due_date=due_date,
            month_label=month_label,
            status='pending',
        )
        payments.append(payment)

    Payment.objects.bulk_create(payments)
    return payments


def regenerate_installments(project):
    """Regenerate installments when project fee or months change.
    Preserves already-paid installments and regenerates remaining ones.
    """
    from .models import Payment

    paid_payments = list(project.payments.filter(status='paid'))
    total_already_paid = sum(float(p.actual_amount or 0) for p in paid_payments)

    project.payments.filter(status__in=['pending', 'partial', 'overdue']).delete()

    remaining_fee = float(project.total_fee) - total_already_paid
    if remaining_fee <= 0:
        return paid_payments

    paid_count = len(paid_payments)
    remaining_months = max(project.installment_months - paid_count, 1)
    monthly_amount = math.ceil(remaining_fee / remaining_months)

    if paid_payments:
        last_paid_date = max(p.due_date for p in paid_payments)
        start_date = last_paid_date + relativedelta(months=1)
    else:
        start_date = project.payment_start_date

    new_payments = []
    for i in range(remaining_months):
        due_date = start_date + relativedelta(months=i)
        scheduled = min(monthly_amount, remaining_fee)
        remaining_fee -= scheduled

        payment = Payment(
            project=project,
            scheduled_amount=Decimal(str(scheduled)),
            due_date=due_date,
            month_label=due_date.strftime('%b %Y'),
            status='pending',
        )
        new_payments.append(payment)
        if remaining_fee <= 0:
            break

    Payment.objects.bulk_create(new_payments)
    return paid_payments + new_payments


def apply_payment(project, amount, payment_method='', receipt_number='', notes=''):
    """
    Apply a payment amount to a project's pending installments in chronological order.
    Returns a list of affected installments with their changes.
    """
    from .models import Payment

    remaining = Decimal(str(amount))
    today = date.today()
    affected = []

    installments = project.payments.filter(
        status__in=['pending', 'partial', 'overdue']
    ).order_by('due_date')

    for inst in installments:
        if remaining <= 0:
            break

        already_paid = inst.actual_amount or Decimal('0')
        still_owed = inst.scheduled_amount - already_paid

        if remaining >= still_owed:
            inst.actual_amount = inst.scheduled_amount
            inst.status = 'paid'
            inst.paid_date = today
            inst.payment_method = payment_method or inst.payment_method
            inst.receipt_number = receipt_number or inst.receipt_number
            if notes:
                inst.notes = (inst.notes + '\n' + notes).strip() if inst.notes else notes
            inst.save()
            remaining -= still_owed
            affected.append({
                'id': inst.id,
                'month_label': inst.month_label,
                'scheduled_amount': float(inst.scheduled_amount),
                'applied': float(still_owed),
                'new_status': 'paid',
            })
        else:
            inst.actual_amount = already_paid + remaining
            inst.status = 'partial'
            inst.payment_method = payment_method or inst.payment_method
            inst.receipt_number = receipt_number or inst.receipt_number
            if notes:
                inst.notes = (inst.notes + '\n' + notes).strip() if inst.notes else notes
            inst.save()
            affected.append({
                'id': inst.id,
                'month_label': inst.month_label,
                'scheduled_amount': float(inst.scheduled_amount),
                'applied': float(remaining),
                'new_status': 'partial',
            })
            remaining = Decimal('0')

    return {
        'affected_installments': affected,
        'excess': float(remaining),
        'total_applied': float(Decimal(str(amount)) - remaining),
    }


def preview_payment(project, amount):
    """
    Preview how a payment will be distributed without saving.
    Returns what would happen if this amount were applied.
    """
    remaining = Decimal(str(amount))
    preview = []

    installments = project.payments.filter(
        status__in=['pending', 'partial', 'overdue']
    ).order_by('due_date')

    for inst in installments:
        if remaining <= 0:
            break

        already_paid = inst.actual_amount or Decimal('0')
        still_owed = inst.scheduled_amount - already_paid

        if remaining >= still_owed:
            preview.append({
                'id': inst.id,
                'month_label': inst.month_label,
                'scheduled_amount': float(inst.scheduled_amount),
                'already_paid': float(already_paid),
                'will_apply': float(still_owed),
                'resulting_status': 'paid',
            })
            remaining -= still_owed
        else:
            preview.append({
                'id': inst.id,
                'month_label': inst.month_label,
                'scheduled_amount': float(inst.scheduled_amount),
                'already_paid': float(already_paid),
                'will_apply': float(remaining),
                'resulting_status': 'partial',
            })
            remaining = Decimal('0')

    return {
        'preview': preview,
        'excess': float(remaining),
        'total_to_apply': float(Decimal(str(amount)) - remaining),
    }


def update_overdue_statuses(org=None):
    """Mark pending installments past due_date as overdue."""
    from .models import Payment
    today = date.today()
    qs = Payment.objects.filter(
        status__in=['pending', 'partial'],
        due_date__lt=today,
    ).exclude(status='paid')
    if org:
        qs = qs.filter(project__organization=org)
    updated = qs.update(status='overdue')
    return updated
