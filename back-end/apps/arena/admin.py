from django.contrib import admin

from .models import ArenaEvent, ArenaRound, TeamContribution


class TeamContributionInline(admin.TabularInline):
    model = TeamContribution
    extra = 0
    readonly_fields = (
        "group", "base_damage", "battle_damage", "retaliation_loss",
        "manual_adjustment",
    )


class ArenaEventInline(admin.TabularInline):
    model = ArenaEvent
    extra = 0
    can_delete = False  # log append-only
    readonly_fields = ("actor", "group", "kind", "value", "message", "created_at")
    fields = ("created_at", "actor", "kind", "group", "value", "message")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ArenaRound)
class ArenaRoundAdmin(admin.ModelAdmin):
    list_display = ("name", "boss", "status", "hp", "max_hp", "level", "date")
    list_filter = ("status",)
    search_fields = ("name", "boss__name")
    inlines = (TeamContributionInline, ArenaEventInline)
    readonly_fields = ("started_at", "finished_at", "rewards_credited", "created_at")


@admin.register(ArenaEvent)
class ArenaEventAdmin(admin.ModelAdmin):
    """Log append-only: sem adição/edição/remoção (auditoria)."""
    list_display = ("created_at", "kind", "actor", "group", "value", "round")
    list_filter = ("kind", "actor")
    readonly_fields = ("round", "actor", "group", "kind", "value", "message", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
