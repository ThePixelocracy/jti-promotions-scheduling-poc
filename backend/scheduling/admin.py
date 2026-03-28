from django.contrib import admin

from .models import LLMCallLog, PointOfSale, Promoter, Schedule, ScheduledVisit


@admin.register(PointOfSale)
class PointOfSaleAdmin(admin.ModelAdmin):
    list_display = (
        "cdb_code",
        "name",
        "pos_type",
        "priority",
        "city",
        "district",
        "is_active",
    )
    list_filter = ("priority", "pos_type", "district", "contractor", "is_active")
    search_fields = ("cdb_code", "name", "city", "territory")


@admin.register(Promoter)
class PromoterAdmin(admin.ModelAdmin):
    list_display = (
        "username",
        "first_name",
        "last_name",
        "programme_type",
        "team",
        "base_city",
        "is_active",
    )
    list_filter = ("programme_type", "team", "is_active")
    search_fields = ("username", "first_name", "last_name", "code")


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "period_start",
        "period_end",
        "status",
        "created_by",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("name",)


@admin.register(ScheduledVisit)
class ScheduledVisitAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "start_time",
        "end_time",
        "pos",
        "promoter",
        "programme_type",
        "action",
        "schedule",
    )
    list_filter = ("programme_type", "action", "schedule")
    search_fields = ("pos__name", "pos__cdb_code", "promoter__last_name")
    date_hierarchy = "date"


@admin.register(LLMCallLog)
class LLMCallLogAdmin(admin.ModelAdmin):
    list_display = (
        "called_at",
        "schedule",
        "model_name",
        "status",
        "total_tokens",
        "optimization_goal",
    )
    list_filter = ("status", "model_name", "schedule")
    search_fields = ("schedule__name", "optimization_goal", "error_message")
    readonly_fields = (
        "called_at",
        "schedule",
        "model_name",
        "optimization_goal",
        "user_prompt",
        "prompt",
        "raw_response",
        "total_tokens",
        "status",
        "error_message",
    )
    date_hierarchy = "called_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
