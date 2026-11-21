from django.contrib import admin

from .models import Group, GroupAbility, TeamAbilityTemplate


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "points", "extra_points", "member_count", "is_active")
    search_fields = ("name",)


@admin.register(TeamAbilityTemplate)
class TeamAbilityTemplateAdmin(admin.ModelAdmin):
    """Catálogo das habilidades de equipe (3+1 por equipe — ADR-021)."""

    list_display = ("name", "theme", "kind", "effect", "value", "max_charges")
    list_filter = ("theme", "kind", "effect")
    search_fields = ("name", "theme")


@admin.register(GroupAbility)
class GroupAbilityAdmin(admin.ModelAdmin):
    """Atribuição da equipe ao modelo — cargas são geridas pela raid."""

    list_display = ("group", "template", "charges_left")
    list_filter = ("template__theme", "template__kind")
    search_fields = ("group__name", "template__name")
