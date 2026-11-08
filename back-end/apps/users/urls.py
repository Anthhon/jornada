from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from .password_reset import PasswordResetConfirmView, PasswordResetRequestView

router = DefaultRouter()
router.register(r'api/students', views.StudentViewSet, basename='student')
router.register(r'api/users', views.UserViewSet, basename='user')

urlpatterns = [
        path('api/password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
        path('api/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
        path('api/me/', views.me, name='me'),
        ] + router.urls
