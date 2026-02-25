from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
import threading

from .models import (
    Student, Teacher, Project, Payment, PrivateClass, ClassPayment, ActivityLog
)

# Thread-local storage to pass the current request user into signals
_thread_locals = threading.local()


def set_current_user(user):
    _thread_locals.user = user


def get_current_user():
    return getattr(_thread_locals, 'user', None)


def _get_org_and_user(instance):
    """Try to get organization and current user for logging."""
    user = get_current_user()
    org = None
    if hasattr(instance, 'organization_id') and instance.organization_id:
        org_id = instance.organization_id
        from .models import Organization
        try:
            org = Organization.objects.get(pk=org_id)
        except Organization.DoesNotExist:
            pass
    elif hasattr(instance, 'organization') and instance.organization:
        org = instance.organization
    elif hasattr(instance, 'project') and instance.project:
        org = instance.project.organization
    return org, user


def _log(org, user, action, entity_type, entity_id, description):
    try:
        ActivityLog.objects.create(
            organization=org,
            user=user,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
        )
    except Exception:
        pass


# ---- Student ----
@receiver(post_save, sender=Student)
def log_student_save(sender, instance, created, **kwargs):
    org, user = _get_org_and_user(instance)
    if created:
        _log(org, user, 'created', 'Student', instance.id, f'Student "{instance.name}" was created')
    else:
        _log(org, user, 'updated', 'Student', instance.id, f'Student "{instance.name}" was updated')


@receiver(post_delete, sender=Student)
def log_student_delete(sender, instance, **kwargs):
    org, user = _get_org_and_user(instance)
    _log(org, user, 'deleted', 'Student', instance.id, f'Student "{instance.name}" was deleted')


# ---- Teacher ----
@receiver(post_save, sender=Teacher)
def log_teacher_save(sender, instance, created, **kwargs):
    org, user = _get_org_and_user(instance)
    if created:
        _log(org, user, 'created', 'Teacher', instance.id, f'Teacher "{instance.name}" was created')
    else:
        _log(org, user, 'updated', 'Teacher', instance.id, f'Teacher "{instance.name}" was updated')


@receiver(post_delete, sender=Teacher)
def log_teacher_delete(sender, instance, **kwargs):
    org, user = _get_org_and_user(instance)
    _log(org, user, 'deleted', 'Teacher', instance.id, f'Teacher "{instance.name}" was deleted')


# ---- Project ----
@receiver(post_save, sender=Project)
def log_project_save(sender, instance, created, **kwargs):
    org, user = _get_org_and_user(instance)
    if created:
        _log(org, user, 'created', 'Project', instance.id,
             f'Project "{instance.code} - {instance.name}" was created for {instance.student.name}')
    else:
        _log(org, user, 'updated', 'Project', instance.id,
             f'Project "{instance.code}" was updated')


@receiver(post_delete, sender=Project)
def log_project_delete(sender, instance, **kwargs):
    org, user = _get_org_and_user(instance)
    _log(org, user, 'deleted', 'Project', instance.id,
         f'Project "{instance.code} - {instance.name}" was deleted')


# ---- Payment (project installment) ----
@receiver(pre_save, sender=Payment)
def capture_payment_old_status(sender, instance, **kwargs):
    if instance.pk:
        try:
            old = Payment.objects.get(pk=instance.pk)
            instance._old_status = old.status
            instance._old_actual_amount = old.actual_amount
        except Payment.DoesNotExist:
            instance._old_status = None
            instance._old_actual_amount = None
    else:
        instance._old_status = None
        instance._old_actual_amount = None


@receiver(post_save, sender=Payment)
def log_payment_save(sender, instance, created, **kwargs):
    org = instance.project.organization if instance.project else None
    user = get_current_user()

    if created:
        return  # installment generation, not interesting

    old_status = getattr(instance, '_old_status', None)
    old_amount = getattr(instance, '_old_actual_amount', None)

    if old_status != instance.status or old_amount != instance.actual_amount:
        if instance.status == 'paid':
            desc = f'Payment of {float(instance.actual_amount or 0):,.0f} QAR recorded for {instance.project.code} ({instance.month_label})'
            _log(org, user, 'payment', 'Payment', instance.id, desc)
        elif old_status != instance.status:
            desc = f'{instance.project.code} installment {instance.month_label} status changed to {instance.status}'
            _log(org, user, 'status_change', 'Payment', instance.id, desc)


# ---- PrivateClass ----
@receiver(pre_save, sender=PrivateClass)
def capture_class_old_status(sender, instance, **kwargs):
    if instance.pk:
        try:
            old = PrivateClass.objects.get(pk=instance.pk)
            instance._old_student_status = old.student_payment_status
            instance._old_teacher_status = old.teacher_payment_status
        except PrivateClass.DoesNotExist:
            instance._old_student_status = None
            instance._old_teacher_status = None
    else:
        instance._old_student_status = None
        instance._old_teacher_status = None


@receiver(post_save, sender=PrivateClass)
def log_class_save(sender, instance, created, **kwargs):
    org, user = _get_org_and_user(instance)
    if created:
        _log(org, user, 'created', 'PrivateClass', instance.id,
             f'Class session added: {instance.student.name} with {instance.teacher.name} on {instance.date}')
    else:
        old_s = getattr(instance, '_old_student_status', None)
        old_t = getattr(instance, '_old_teacher_status', None)
        if old_s and old_s != instance.student_payment_status:
            _log(org, user, 'status_change', 'PrivateClass', instance.id,
                 f'Student payment for class {instance.date} ({instance.student.name}) marked {instance.student_payment_status}')
        elif old_t and old_t != instance.teacher_payment_status:
            _log(org, user, 'status_change', 'PrivateClass', instance.id,
                 f'Teacher payment for class {instance.date} ({instance.teacher.name}) marked {instance.teacher_payment_status}')
        else:
            _log(org, user, 'updated', 'PrivateClass', instance.id,
                 f'Class session on {instance.date} ({instance.student.name}) was updated')


@receiver(post_delete, sender=PrivateClass)
def log_class_delete(sender, instance, **kwargs):
    org, user = _get_org_and_user(instance)
    _log(org, user, 'deleted', 'PrivateClass', instance.id,
         f'Class session on {instance.date} ({instance.student.name} / {instance.teacher.name}) was deleted')


# ---- ClassPayment ----
@receiver(post_save, sender=ClassPayment)
def log_class_payment_save(sender, instance, created, **kwargs):
    org, user = _get_org_and_user(instance)
    if created:
        _log(org, user, 'payment', 'ClassPayment', instance.id,
             f'Class payment of {float(instance.amount):,.0f} {instance.currency} received from {instance.student.name}')


@receiver(post_delete, sender=ClassPayment)
def log_class_payment_delete(sender, instance, **kwargs):
    org, user = _get_org_and_user(instance)
    _log(org, user, 'deleted', 'ClassPayment', instance.id,
         f'Class payment of {float(instance.amount):,.0f} {instance.currency} for {instance.student.name} was deleted')
