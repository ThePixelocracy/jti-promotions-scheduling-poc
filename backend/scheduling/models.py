from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import models

User = get_user_model()


class PointOfSale(models.Model):
    class Priority(models.TextChoices):
        STRATEGIC = "Strategic", "Strategic"
        PRIME = "Prime", "Prime"
        BASELINE = "BaseLine", "BaseLine"
        DEVELOPING = "Developing", "Developing"

    cdb_code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255)
    pos_type = models.CharField(max_length=100, blank=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    county = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)
    territory = models.CharField(max_length=100, blank=True)
    chain = models.CharField(max_length=100, blank=True)
    contractor = models.CharField(max_length=100, blank=True)
    warehouse = models.CharField(max_length=100, blank=True)
    telephone = models.CharField(max_length=30, blank=True)
    mobile = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Point of Sale"
        verbose_name_plural = "Points of Sale"
        ordering = ["name"]

    def __str__(self):
        return f"{self.cdb_code} – {self.name}"


class Promoter(models.Model):
    class ProgrammeType(models.TextChoices):
        PERMANENT = "Permanent", "Permanent"
        EXCLUSIVE = "Exclusive", "Exclusive"
        RADICAL = "Radical", "Radical"

    class Team(models.TextChoices):
        SOUTH = "SOUTH TEAM", "South Team"
        NORTH = "NORTH TEAM", "North Team"

    code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    username = models.CharField(max_length=100, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    programme_type = models.CharField(max_length=20, choices=ProgrammeType.choices)
    base_city = models.CharField(max_length=100, blank=True)
    team = models.CharField(max_length=20, choices=Team.choices, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.programme_type})"


class Schedule(models.Model):
    class Status(models.TextChoices):
        DRAFT = "Draft", "Draft"
        PUBLISHED = "Published", "Published"
        ARCHIVED = "Archived", "Archived"

    name = models.CharField(max_length=255)
    period_start = models.DateField()
    period_end = models.DateField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="schedules"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    score = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    included_pos = models.ManyToManyField(
        "PointOfSale", blank=True, related_name="schedules_included"
    )
    included_promoters = models.ManyToManyField(
        "Promoter", blank=True, related_name="schedules_included"
    )

    class Meta:
        ordering = ["-period_start"]

    def __str__(self):
        return f"{self.name} ({self.period_start} → {self.period_end})"

    def clean(self):
        if self.period_end < self.period_start:
            raise ValidationError("period_end must be on or after period_start.")


class ScheduledVisit(models.Model):
    class ProgrammeType(models.TextChoices):
        PERMANENT = "Permanent", "Permanent"
        EXCLUSIVE = "Exclusive", "Exclusive"
        RADICAL = "Radical", "Radical"

    class Action(models.TextChoices):
        EXECUTED = "Executed", "Executed"
        CANCELLED = "Cancelled", "Cancelled"
        CHANGE_VISIT = "Change Visit", "Change Visit"
        DOUBLE_VISIT = "Double Visit", "Double Visit"

    schedule = models.ForeignKey(
        Schedule, on_delete=models.CASCADE, related_name="visits"
    )
    promoter = models.ForeignKey(
        Promoter,
        on_delete=models.PROTECT,
        related_name="visits",
        null=True,
        blank=True,
    )
    pos = models.ForeignKey(
        PointOfSale, on_delete=models.PROTECT, related_name="visits"
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    programme_type = models.CharField(max_length=20, choices=ProgrammeType.choices)
    out_of_premises = models.BooleanField(default=False)
    week_label = models.CharField(max_length=10, blank=True)
    action = models.CharField(max_length=20, choices=Action.choices, blank=True)
    reason = models.CharField(max_length=100, blank=True)
    comments = models.TextField(blank=True)
    comments_meeting = models.TextField(blank=True)

    class Meta:
        ordering = ["date", "start_time"]

    def __str__(self):
        promoter_str = str(self.promoter) if self.promoter else "Unassigned"
        return f"{self.date} {self.start_time} – {self.pos} ({promoter_str})"

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError("end_time must be after start_time.")
        if (
            self.date < self.schedule.period_start
            or self.date > self.schedule.period_end
        ):
            raise ValidationError("Visit date must fall within the schedule's period.")


class LLMCallLog(models.Model):
    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        ERROR = "error", "Error"

    schedule = models.ForeignKey(
        Schedule, on_delete=models.CASCADE, related_name="llm_call_logs"
    )
    called_at = models.DateTimeField(auto_now_add=True)
    model_name = models.CharField(max_length=100)
    optimization_goal = models.CharField(max_length=255)
    user_prompt = models.TextField(blank=True)
    prompt = models.JSONField()
    raw_response = models.TextField()
    total_tokens = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-called_at"]
        verbose_name = "LLM Call Log"
        verbose_name_plural = "LLM Call Logs"

    def __str__(self):
        return f"{self.schedule} — {self.called_at:%Y-%m-%d %H:%M} ({self.status})"
