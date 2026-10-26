from rest_framework.routers import DefaultRouter

from .views import SpellViewSet

router = DefaultRouter()
router.register(r"api/spells", SpellViewSet, basename="spell")

urlpatterns = router.urls
