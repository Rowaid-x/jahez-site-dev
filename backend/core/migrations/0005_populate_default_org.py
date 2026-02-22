from django.db import migrations


def populate_default_org(apps, schema_editor):
    Organization = apps.get_model('core', 'Organization')
    UserProfile = apps.get_model('core', 'UserProfile')
    Student = apps.get_model('core', 'Student')
    Teacher = apps.get_model('core', 'Teacher')
    Project = apps.get_model('core', 'Project')
    PrivateClass = apps.get_model('core', 'PrivateClass')
    User = apps.get_model('auth', 'User')

    # Create default organization
    org, _ = Organization.objects.get_or_create(name='Jahez Academy')

    # Assign all existing data to default org
    Student.objects.filter(organization__isnull=True).update(organization=org)
    Teacher.objects.filter(organization__isnull=True).update(organization=org)
    Project.objects.filter(organization__isnull=True).update(organization=org)
    PrivateClass.objects.filter(organization__isnull=True).update(organization=org)

    # Create UserProfile for all existing users that don't have one
    for user in User.objects.all():
        UserProfile.objects.get_or_create(user=user, defaults={'organization': org})


def reverse_populate(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_add_organization_and_tenant'),
    ]

    operations = [
        migrations.RunPython(populate_default_org, reverse_populate),
    ]
