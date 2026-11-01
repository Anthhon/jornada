from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'api/students', views.StudentViewSet, basename='student')
router.register(r'api/users', views.UserViewSet, basename='user')

urlpatterns = [
        path('api/me/', views.me, name='me'),
        ] + router.urls
