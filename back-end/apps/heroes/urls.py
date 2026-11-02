from rest_framework.routers import DefaultRouter

from .views import HeroViewSet

router = DefaultRouter()
router.register(r"api/heroes", HeroViewSet, basename="hero")

urlpatterns = router.urls
