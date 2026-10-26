from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import GroupViewSet, LeaderboardView

router = DefaultRouter()
router.register(r"api/groups", GroupViewSet, basename="group")

urlpatterns = [
    path("api/leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
] + router.urls
