from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import Student, Teacher, Project, Payment
from core.payment_logic import generate_installments, apply_payment
from datetime import date
from decimal import Decimal


class Command(BaseCommand):
    help = 'Load real project data'

    def handle(self, *args, **options):
        self.stdout.write('Loading real project data...')

        # Create admin user if not exists
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@jahez.qa', 'admin123')
            self.stdout.write(self.style.SUCCESS('Created admin user (admin/admin123)'))
        else:
            self.stdout.write('Admin user already exists.')

        # ===================== TEACHERS =====================
        teachers = {}
        teacher_data = [
            {'name': 'Nasser', 'expertise': ''},
            {'name': 'Ahmad -mustaqel', 'expertise': ''},
            {'name': 'Abdulaziz', 'expertise': ''},
            {'name': 'Sajeda+Nasser', 'expertise': ''},
            {'name': 'Rowaid+', 'expertise': ''},
            {'name': 'Faris & Lana', 'expertise': ''},
            {'name': 'Nour+Nasser', 'expertise': ''},
            {'name': 'Ahmad Sqor', 'expertise': ''},
        ]
        for td in teacher_data:
            t, _ = Teacher.objects.get_or_create(name=td['name'], defaults={
                'expertise': td['expertise'],
            })
            teachers[td['name']] = t
        self.stdout.write(self.style.SUCCESS(f'Created/found {len(teachers)} teachers'))

        # ===================== STUDENTS =====================
        students = {}
        student_data = [
            {'name': 'Mohammed +1', 'phone': '97466734799', 'notes': 'UDST'},
            {'name': 'Abdullah +3', 'phone': '97477787668', 'notes': 'UDST'},
            {'name': 'Ahmad Al-shafei', 'phone': '97450505089', 'notes': 'University of Liverpool'},
            {'name': 'Nujood', 'phone': '+974 6627 6667', 'notes': ''},
            {'name': 'Muna', 'phone': '', 'notes': ''},
            {'name': 'Khaled', 'phone': '', 'notes': 'University of Liverpool'},
            {'name': 'Abdulrahman', 'phone': '+974 5011 1084', 'notes': 'University of Liverpool'},
            {'name': 'Mohamed', 'phone': '97430301060', 'notes': 'University of Liverpool'},
            {'name': 'Munera', 'phone': '+974 3045 7999', 'notes': ''},
            {'name': 'Mohammed (Aberdeen)', 'phone': '', 'notes': 'University of Aberdeen in Doha'},
            {'name': 'Waleed', 'phone': '', 'notes': 'Oryx University'},
            {'name': 'Njoud', 'phone': '', 'notes': ''},
            {'name': 'Ahmad (Liverpool JM)', 'phone': '', 'notes': 'Liverpool John Moores'},
            {'name': 'Noura', 'phone': '', 'notes': 'Qatar University'},
            {'name': 'Nasser (Student)', 'phone': '', 'notes': ''},
            {'name': 'Group (Green House)', 'phone': '', 'notes': ''},
            {'name': 'Abdulaziz (Student)', 'phone': '', 'notes': 'Public Procurement'},
            {'name': 'Saleh', 'phone': '+974 5564 4665', 'notes': 'Oryx University'},
            {'name': 'Ahmed (Oryx)', 'phone': '+974 3133 1533', 'notes': 'Oryx University'},
        ]
        for sd in student_data:
            s, _ = Student.objects.get_or_create(name=sd['name'], defaults={
                'phone': sd['phone'],
                'notes': sd['notes'],
            })
            students[sd['name']] = s
        self.stdout.write(self.style.SUCCESS(f'Created/found {len(students)} students'))

        # ===================== PROJECTS =====================
        projects_data = [
            {
                'code': '1033',
                'name': 'PV-sun tracking',
                'student': 'Mohammed +1',
                'teacher': 'Nasser',
                'total_fee': Decimal('6000'),
                'installment_months': 1,
                'payment_start_date': date(2025, 10, 1),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('6000'),
                'notes': 'Capstone 2 - Paid In Full - Deadline: End of Oct',
            },
            {
                'code': '1034',
                'name': 'Green house',
                'student': 'Abdullah +3',
                'teacher': 'Nasser',
                'total_fee': Decimal('20000'),
                'installment_months': 2,
                'payment_start_date': date(2025, 12, 1),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('12500'),
                'notes': 'Capstone 1 & 2 - Remaining 7,500 - Teacher fee TBD - FINAL 4 Dec',
            },
            {
                'code': '1035',
                'name': 'Radio-mimic',
                'student': 'Ahmad Al-shafei',
                'teacher': 'Nasser',
                'total_fee': Decimal('8980'),
                'installment_months': 2,
                'payment_start_date': date(2025, 9, 5),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('8980'),
                'notes': 'Graduation project - University of Liverpool - Original: 2850 GBP - Remaining 5,020 QAR - Deadline: During April 2026',
            },
            {
                'code': '1036',
                'name': 'AI-teacher Website',
                'student': 'Nujood',
                'teacher': 'Ahmad -mustaqel',
                'total_fee': Decimal('19500'),
                'installment_months': 1,
                'payment_start_date': date(2025, 9, 24),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('19500'),
                'notes': 'Paid in full - Start: 24 Sep - Deadline: 25 Oct',
            },
            {
                'code': '1037',
                'name': 'AI-teacher APP',
                'student': 'Muna',
                'teacher': 'Ahmad -mustaqel',
                'total_fee': Decimal('15000'),
                'installment_months': 1,
                'payment_start_date': date(2025, 9, 19),
                'teacher_fee': Decimal('2738'),
                'teacher_paid': False,
                'paid_amount': Decimal('15000'),
                'notes': 'project-master - Paid in full - Teacher fee: 750 USD',
            },
            {
                'code': '1038',
                'name': 'Musical instrument',
                'student': 'Khaled',
                'teacher': 'Nasser',
                'total_fee': Decimal('8462'),
                'installment_months': 2,
                'payment_start_date': date(2025, 9, 20),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('924'),
                'notes': 'Graduation project - University of Liverpool - Original: 3300 GBP - Remaining 7538 QAR - Deadline: During April',
            },
            {
                'code': '1039',
                'name': 'Graduation Project (Abdulrahman)',
                'student': 'Abdulrahman',
                'teacher': 'Abdulaziz',
                'total_fee': Decimal('12272'),
                'installment_months': 3,
                'payment_start_date': date(2025, 9, 23),
                'teacher_fee': Decimal('2555'),
                'teacher_paid': False,
                'paid_amount': Decimal('2309'),
                'notes': 'University of Liverpool - Original: 3300 GBP - Remaining 9,963 QAR - Teacher fee: 700 USD - Deadline: During April',
            },
            {
                'code': '1040',
                'name': 'Graduation Project (Mohamed)',
                'student': 'Mohamed',
                'teacher': 'Abdulaziz',
                'total_fee': Decimal('19188'),
                'installment_months': 3,
                'payment_start_date': date(2025, 10, 1),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('10656'),
                'notes': 'University of Liverpool - Original: 3900 GBP - Remaining 8532 QAR - Deadline: April',
            },
            {
                'code': '1042',
                'name': 'Half Chapter (Book)',
                'student': 'Munera',
                'teacher': 'Nasser',
                'total_fee': Decimal('1500'),
                'installment_months': 1,
                'payment_start_date': date(2025, 10, 1),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('1500'),
                'notes': 'Book - Paid in full',
            },
            {
                'code': 'P206',
                'name': 'Assessment',
                'student': 'Mohammed (Aberdeen)',
                'teacher': 'Nasser',
                'total_fee': Decimal('1500'),
                'installment_months': 1,
                'payment_start_date': date(2025, 10, 13),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('1500'),
                'notes': 'Course project - University of Aberdeen in Doha - Paid in full - Deadline: 6/Nov',
            },
            {
                'code': '1043',
                'name': 'Computer Security',
                'student': 'Waleed',
                'teacher': 'Sajeda+Nasser',
                'total_fee': Decimal('300'),
                'installment_months': 1,
                'payment_start_date': date(2025, 10, 20),
                'teacher_fee': Decimal('219'),
                'teacher_paid': False,
                'paid_amount': Decimal('200'),
                'notes': 'Course work - Oryx University - Remaining 100 - Teacher fee: 60 JD Sajeda - Deadline: 2/Nov',
            },
            {
                'code': '1044',
                'name': '6 Chapters (Book)',
                'student': 'Munera',
                'teacher': 'Nasser',
                'total_fee': Decimal('4000'),
                'installment_months': 1,
                'payment_start_date': date(2025, 11, 1),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('4000'),
                'notes': 'Book - 2000-4000 range - Paid in full',
            },
            {
                'code': '1045',
                'name': 'إطار لتأهيل قائد فني مؤثّر في المجتمع',
                'student': 'Njoud',
                'teacher': 'Nasser',
                'total_fee': Decimal('12500'),
                'installment_months': 3,
                'payment_start_date': date(2026, 1, 1),
                'teacher_fee': Decimal('292'),
                'teacher_paid': False,
                'paid_amount': Decimal('0'),
                'notes': 'MASTER - Teacher fee: 80 JD Sajeda',
            },
            {
                'code': '1046',
                'name': 'AI-Based Network Anomaly Detection',
                'student': 'Ahmad (Liverpool JM)',
                'teacher': 'Rowaid+',
                'total_fee': Decimal('15000'),
                'installment_months': 3,
                'payment_start_date': date(2026, 1, 29),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('5000'),
                'notes': 'PhD Project - Liverpool John Moores - Paid 5000 rowaid - Remaining 10,000 - Deadline: April',
            },
            {
                'code': '1047',
                'name': 'Office building drawings',
                'student': 'Noura',
                'teacher': 'Faris & Lana',
                'total_fee': Decimal('4000'),
                'installment_months': 2,
                'payment_start_date': date(2026, 1, 26),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('500'),
                'notes': 'Course Project - Qatar University - Remaining 3500 - Deadline: Beginning of June',
            },
            {
                'code': '1130',
                'name': 'PhD Project (Nasser)',
                'student': 'Nasser (Student)',
                'teacher': 'Nasser',
                'total_fee': Decimal('7000'),
                'installment_months': 3,
                'payment_start_date': date(2026, 2, 1),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('0'),
                'notes': 'PhD Project',
            },
            {
                'code': '1131',
                'name': 'Green house (Group)',
                'student': 'Group (Green House)',
                'teacher': 'Abdulaziz',
                'total_fee': Decimal('1825'),
                'installment_months': 1,
                'payment_start_date': date(2026, 2, 1),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('0'),
                'notes': 'Bachelor, Group Student - Original: 500 USD',
            },
            {
                'code': '1132',
                'name': 'Supply Chain',
                'student': 'Abdulaziz (Student)',
                'teacher': 'Nour+Nasser',
                'total_fee': Decimal('10000'),
                'installment_months': 3,
                'payment_start_date': date(2026, 2, 1),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('0'),
                'notes': 'PhD Project - Public Procurement',
            },
            {
                'code': 'J03+J02',
                'name': 'Cyber security + Green Zone',
                'student': 'Saleh',
                'teacher': 'Abdulaziz',
                'total_fee': Decimal('3500'),
                'installment_months': 1,
                'payment_start_date': date(2026, 2, 14),
                'teacher_fee': Decimal('1643'),
                'teacher_paid': False,
                'paid_amount': Decimal('0'),
                'notes': 'Master (Course Project) - Oryx University - Teacher fee: 450 USD - Deadline: Beginning of March',
            },
            {
                'code': 'J02',
                'name': 'Cyber security (Ahmed)',
                'student': 'Ahmed (Oryx)',
                'teacher': 'Ahmad Sqor',
                'total_fee': Decimal('2000'),
                'installment_months': 1,
                'payment_start_date': date(2026, 2, 14),
                'teacher_fee': Decimal('584'),
                'teacher_paid': False,
                'paid_amount': Decimal('0'),
                'notes': 'Master (Course Project) - Oryx University - Teacher fee: 160 JD - Deadline: Beginning of March',
            },
            {
                'code': 'J03',
                'name': 'Greenzone (Ahmed)',
                'student': 'Ahmed (Oryx)',
                'teacher': 'Abdulaziz',
                'total_fee': Decimal('2000'),
                'installment_months': 1,
                'payment_start_date': date(2026, 2, 14),
                'teacher_fee': None,
                'teacher_paid': False,
                'paid_amount': Decimal('0'),
                'notes': 'Master (Course Project) - Oryx University - Deadline: Beginning of March',
            },
        ]

        created_count = 0
        for pd in projects_data:
            if Project.objects.filter(code=pd['code']).exists():
                self.stdout.write(f"  Project {pd['code']} already exists, skipping.")
                continue

            project = Project.objects.create(
                code=pd['code'],
                name=pd['name'],
                student=students[pd['student']],
                teacher=teachers[pd['teacher']],
                total_fee=pd['total_fee'],
                installment_months=pd['installment_months'],
                payment_start_date=pd['payment_start_date'],
                teacher_fee=pd['teacher_fee'],
                teacher_paid=pd['teacher_paid'],
                notes=pd['notes'],
            )

            generate_installments(project)

            if pd['paid_amount'] and pd['paid_amount'] > 0:
                apply_payment(project, pd['paid_amount'])

            created_count += 1
            self.stdout.write(f"  Created project {pd['code']} - {pd['name']}")

        self.stdout.write(self.style.SUCCESS(f'\nDone! Created {created_count} projects.'))
        self.stdout.write(self.style.SUCCESS('Run "python manage.py createsuperuser" if you need a new admin.'))
