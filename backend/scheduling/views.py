from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PointOfSale, Promoter, Schedule
from .serializers import (
    PointOfSaleSerializer,
    PromoterSerializer,
    ScheduleCreateSerializer,
    ScheduleSerializer,
)


class ScheduleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ScheduleCreateSerializer
        return ScheduleSerializer

    def get_queryset(self):
        qs = Schedule.objects.select_related("created_by").order_by("-period_start")
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        out = ScheduleSerializer(serializer.instance, context={"request": request})
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)


class PointOfSaleListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PointOfSaleSerializer
    queryset = PointOfSale.objects.filter(is_active=True).order_by("name")


class PromoterListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PromoterSerializer
    queryset = Promoter.objects.filter(is_active=True).order_by(
        "last_name", "first_name"
    )
