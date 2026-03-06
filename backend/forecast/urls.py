from django.urls import path
from .views import run_forecast

urlpatterns = [
    path("run/", run_forecast),
]