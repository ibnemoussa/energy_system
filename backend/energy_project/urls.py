from django.urls import path, include

urlpatterns = [
    path("api/forecast/", include("forecast.urls")),
]
