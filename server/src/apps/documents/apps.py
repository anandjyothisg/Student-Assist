from django.apps import AppConfig


class DocumentsConfig(AppConfig):
    name = "apps.documents"
    label = "documents"
    verbose_name = "Documents"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from apps.documents import signals  # noqa: F401  (file and vector cleanup on delete)
