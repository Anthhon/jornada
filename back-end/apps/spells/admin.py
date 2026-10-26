from django.contrib import admin

from .models import Spell


@admin.register(Spell)
class SpellAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "spell_type",
        "base_value",
        "max_value",
        "cooldown_turns",
        "is_active",
    )
    list_filter = ("spell_type", "is_active")
    search_fields = ("name",)
