from rest_framework.exceptions import PermissionDenied


def get_user_org(request):
    """Get the organization for the current authenticated user."""
    if not request.user or not request.user.is_authenticated:
        raise PermissionDenied("Authentication required.")
    try:
        return request.user.profile.organization
    except Exception:
        raise PermissionDenied("User is not assigned to any organization.")


class OrgQuerySetMixin:
    """
    Mixin for ViewSets that filters queryset by the user's organization.
    The model must have an 'organization' field.
    """
    org_field = 'organization'

    def get_queryset(self):
        qs = super().get_queryset()
        org = get_user_org(self.request)
        return qs.filter(**{self.org_field: org})

    def perform_create(self, serializer):
        org = get_user_org(self.request)
        serializer.save(organization=org)


class OrgPaymentQuerySetMixin:
    """
    Mixin for Payment ViewSet — Payment doesn't have org directly,
    it inherits from project.organization.
    """
    def get_queryset(self):
        qs = super().get_queryset()
        org = get_user_org(self.request)
        return qs.filter(project__organization=org)
