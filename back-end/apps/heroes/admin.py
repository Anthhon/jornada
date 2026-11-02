from django.contrib import admin

from .models import Hero


@admin.register(Hero)
class HeroAdmin(admin.ModelAdmin):
    list_display = ("name", "group", "journey", "is_active", "power_bonus")
    search_fields = ("name", "group__name", "journey__name")
    filter_horizontal = ("spells",)
