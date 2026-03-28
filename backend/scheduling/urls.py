from django.urls import path

from . import views

urlpatterns = [
    path("schedules/", views.ScheduleListCreateView.as_view()),
    path("pos/", views.PointOfSaleListView.as_view()),
    path("promoters/", views.PromoterListView.as_view()),
]
