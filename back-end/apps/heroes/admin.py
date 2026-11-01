from django.contrib import admin

from .models import Hero


@admin.register(Hero)
class HeroAdmin(admin.ModelAdmin):
    list_display = ("name", "group", "hp", "shield", "power_bonus")
    search_fields = ("name", "group__name")
    filter_horizontal = ("spells",)
