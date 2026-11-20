from rest_framework.routers import DefaultRouter

from .views import ArenaRoundViewSet

router = DefaultRouter()
router.register(r"api/arena/rounds", ArenaRoundViewSet, basename="arena-round")

urlpatterns = router.urls
