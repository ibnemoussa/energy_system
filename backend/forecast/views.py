from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .services.ann_service import run_ann_forecast


@api_view(["POST"])
def run_forecast(request):
    mode        = request.data.get("mode")
    single_date = request.data.get("single_date")
    start_date  = request.data.get("start_date")
    end_date    = request.data.get("end_date")

    if mode not in ("single", "range"):
        return Response(
            {"error": "mode must be 'single' or 'range'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if mode == "single" and not single_date:
        return Response(
            {"error": "single_date is required for single-day forecasts."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if mode == "range" and (not start_date or not end_date):
        return Response(
            {"error": "start_date and end_date are required for range forecasts."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        result = run_ann_forecast(mode, single_date, start_date, end_date)
        return Response(result)
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
