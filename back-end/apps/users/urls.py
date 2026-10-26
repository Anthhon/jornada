from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'api/students', views.StudentViewSet, basename='student')

urlpatterns = [
        path('api/users/', views.user_list, name='users_list'),
        ] + router.urls
