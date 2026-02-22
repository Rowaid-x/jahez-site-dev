from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import Organization, UserProfile


class Command(BaseCommand):
    help = 'Create a new tenant (organization + admin user)'

    def add_arguments(self, parser):
        parser.add_argument('org_name', type=str, help='Organization name')
        parser.add_argument('username', type=str, help='Admin username')
        parser.add_argument('password', type=str, help='Admin password')
        parser.add_argument('--email', type=str, default='', help='Admin email (optional)')

    def handle(self, *args, **options):
        org_name = options['org_name']
        username = options['username']
        password = options['password']
        email = options['email']

        # Create organization
        org, created = Organization.objects.get_or_create(name=org_name)
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created organization: {org_name}'))
        else:
            self.stdout.write(f'Organization "{org_name}" already exists.')

        # Create user
        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            self.stdout.write(f'User "{username}" already exists.')
        else:
            user = User.objects.create_superuser(username, email, password)
            self.stdout.write(self.style.SUCCESS(f'Created admin user: {username}'))

        # Link user to organization
        profile, created = UserProfile.objects.get_or_create(
            user=user, defaults={'organization': org}
        )
        if not created and profile.organization != org:
            profile.organization = org
            profile.save()
            self.stdout.write(f'Updated user "{username}" to organization "{org_name}"')

        self.stdout.write(self.style.SUCCESS(
            f'\nTenant ready! Login with username="{username}" password="{password}"'
            f'\nOrganization: {org_name}'
        ))
