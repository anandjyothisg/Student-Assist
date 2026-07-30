"""
SmartStudent AI — Celery Application Configuration

Start worker:
    celery -A config worker -l info

Start beat (scheduler):
    celery -A config beat -l info

Flower monitoring:
    celery -A config flower
"""

import os

from celery import Celery

# Tell Celery which Django settings module to use
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("smartstudent")

# Read Celery config from Django settings using the CELERY_ namespace prefix
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all INSTALLED_APPS (looks for tasks.py in each app)
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self) -> None:
    """Utility task for verifying the worker is alive."""
    print(f"Request: {self.request!r}")
