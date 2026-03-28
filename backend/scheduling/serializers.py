from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import PointOfSale, Promoter, Schedule


class ScheduleSerializer(serializers.ModelSerializer):
    created_by = serializers.CharField(source="created_by.username", read_only=True)
    pos_count = serializers.SerializerMethodField()
    promoter_count = serializers.SerializerMethodField()

    class Meta:
        model = Schedule
        fields = [
            "id",
            "name",
            "period_start",
            "period_end",
            "status",
            "created_by",
            "created_at",
            "pos_count",
            "promoter_count",
        ]

    def get_pos_count(self, obj):
        return obj.included_pos.count()

    def get_promoter_count(self, obj):
        return obj.included_promoters.count()


class ScheduleCreateSerializer(serializers.ModelSerializer):
    included_pos = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PointOfSale.objects.all()
    )
    included_promoters = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Promoter.objects.all()
    )

    class Meta:
        model = Schedule
        fields = [
            "name",
            "period_start",
            "period_end",
            "included_pos",
            "included_promoters",
        ]

    def validate(self, data):
        instance = Schedule(
            name=data["name"],
            period_start=data["period_start"],
            period_end=data["period_end"],
        )
        try:
            instance.clean()
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages)
        return data

    def create(self, validated_data):
        pos_list = validated_data.pop("included_pos")
        promoters_list = validated_data.pop("included_promoters")
        schedule = Schedule.objects.create(
            **validated_data,
            status=Schedule.Status.DRAFT,
            created_by=self.context["request"].user,
        )
        schedule.included_pos.set(pos_list)
        schedule.included_promoters.set(promoters_list)
        return schedule


class PointOfSaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PointOfSale
        fields = ["id", "cdb_code", "name", "city", "priority"]


class PromoterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promoter
        fields = ["id", "username", "first_name", "last_name", "programme_type", "team"]
