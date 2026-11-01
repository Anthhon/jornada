from django.contrib import admin

from .models import BattleEvent, GroupJourney, Journey, Stage, StageProgress


@admin.register(Journey)
class JourneyAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(Stage)
class StageAdmin(admin.ModelAdmin):
    list_display = ("journey", "order", "name", "max_score")
    list_filter = ("journey",)
    search_fields = ("name",)
    filter_horizontal = ("boss_pool",)


@admin.register(GroupJourney)
class GroupJourneyAdmin(admin.ModelAdmin):
    list_display = ("group", "journey", "status", "current_stage", "total_score")
    list_filter = ("status", "journey")


@admin.register(StageProgress)
class StageProgressAdmin(admin.ModelAdmin):
    list_display = ("group_journey", "stage", "boss", "score", "status", "hp")
    list_filter = ("status",)


@admin.register(BattleEvent)
class BattleEventAdmin(admin.ModelAdmin):
    list_display = ("progress", "turn", "actor", "value", "created_at")
    list_filter = ("actor",)
    # Log append-only: no admin também não se apaga (auditoria da disputa).
    def has_delete_permission(self, request, obj=None):
        return False
