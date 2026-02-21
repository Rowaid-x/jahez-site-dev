from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import Student, Teacher, Project, Payment
from core.payment_logic import generate_installments, apply_payment
from datetime import date
from decimal import Decimal


class Command(BaseCommand):
    help = 'Seed the database with test data'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        # Create admin user
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@jahez.qa', 'admin123')
            self.stdout.write(self.style.SUCCESS('Created admin user (admin/admin123)'))

        # Students
        s1 = Student.objects.get_or_create(name='أحمد محمد الخليفي', defaults={
            'phone': '+974 5512 3456', 'email': 'ahmad@example.com',
            'notes': 'CS senior student',
        })[0]
        s2 = Student.objects.get_or_create(name='فاطمة عبدالله العمادي', defaults={
            'phone': '+974 5598 7654', 'email': 'fatima@example.com',
            'notes': 'Engineering graduate',
        })[0]
        s3 = Student.objects.get_or_create(name='خالد يوسف المري', defaults={
            'phone': '+974 5534 5678', 'email': 'khaled@example.com',
        })[0]
        self.stdout.write(self.style.SUCCESS('Created 3 students'))

        # Teachers
        t1 = Teacher.objects.get_or_create(name='د. إبراهيم حسن', defaults={
            'phone': '+974 5501 1111', 'email': 'ibrahim@jahez.qa',
            'expertise': 'AI & Machine Learning',
        })[0]
        t2 = Teacher.objects.get_or_create(name='د. مصطفى علي', defaults={
            'phone': '+974 5502 2222', 'email': 'mustafa@jahez.qa',
            'expertise': 'Web Development & Cloud',
        })[0]
        self.stdout.write(self.style.SUCCESS('Created 2 teachers'))

        # Projects
        p1, created1 = Project.objects.get_or_create(code='1022', defaults={
            'name': 'AI Chatbot for Customer Service',
            'student': s1, 'teacher': t1,
            'total_fee': Decimal('6000'), 'installment_months': 3,
            'payment_start_date': date(2026, 1, 1),
            'teacher_fee': Decimal('3000'),
        })
        if created1:
            generate_installments(p1)
            # Simulate some payments: student paid first 2 months
            apply_payment(p1, Decimal('4000'))

        p2, created2 = Project.objects.get_or_create(code='1023', defaults={
            'name': 'E-Commerce Platform Development',
            'student': s1, 'teacher': t2,
            'total_fee': Decimal('8000'), 'installment_months': 4,
            'payment_start_date': date(2026, 2, 1),
            'teacher_fee': Decimal('4000'),
        })
        if created2:
            generate_installments(p2)
            # Student paid first installment
            apply_payment(p2, Decimal('2000'))

        p3, created3 = Project.objects.get_or_create(code='1024', defaults={
            'name': 'Mobile App for Campus Navigation',
            'student': s2, 'teacher': t1,
            'total_fee': Decimal('5000'), 'installment_months': 5,
            'payment_start_date': date(2026, 1, 1),
            'teacher_fee': Decimal('2500'),
            'teacher_paid': True,
            'teacher_paid_date': date(2026, 1, 15),
        })
        if created3:
            generate_installments(p3)
            # Fully paid
            apply_payment(p3, Decimal('5000'))

        p4, created4 = Project.objects.get_or_create(code='1025', defaults={
            'name': 'Data Analytics Dashboard',
            'student': s3, 'teacher': t2,
            'total_fee': Decimal('10000'), 'installment_months': 5,
            'payment_start_date': date(2026, 3, 1),
            'teacher_fee': Decimal('5000'),
        })
        if created4:
            generate_installments(p4)
            # No payments yet

        self.stdout.write(self.style.SUCCESS('Created 4 projects with payment schedules'))
        self.stdout.write(self.style.SUCCESS('Seed complete!'))
