from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import PasswordResetForm, SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.utils.translation import override
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView


class ResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class ResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=100)
    token = serializers.CharField(max_length=200)
    new_password = serializers.CharField(trim_whitespace=False, max_length=4096)


class ResetResultSerializer(serializers.Serializer):
    detail = serializers.CharField()


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    @extend_schema(request=ResetRequestSerializer, responses=ResetResultSerializer)
    def post(self, request):
        serializer = ResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        form = PasswordResetForm(serializer.validated_data)
        if not form.is_valid():
            raise serializers.ValidationError(form.errors)
        form.save(
            domain_override=urlsplit(settings.FRONTEND_URL).netloc,
            from_email=settings.DEFAULT_FROM_EMAIL,
            subject_template_name='users/password_reset_subject.txt',
            email_template_name='users/password_reset_email.txt',
            extra_email_context={'frontend_url': settings.FRONTEND_URL.rstrip('/')},
        )
        # A mesma resposta é usada para contas inexistentes, inativas ou sem senha.
        return Response({'detail': 'Se houver uma conta ativa com esse e-mail, enviaremos um link de recuperação.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset_confirm'

    @extend_schema(request=ResetConfirmSerializer, responses=ResetResultSerializer)
    def post(self, request):
        serializer = ResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        User = get_user_model()
        invalid = {'detail': 'Este link expirou ou é inválido. Solicite um novo link.', 'code': 'invalid_token'}
        with transaction.atomic():
            try:
                uid = force_str(urlsafe_base64_decode(data['uid']))
                user = User.objects.select_for_update().get(pk=uid, is_active=True)
            except (ValueError, TypeError, OverflowError, UnicodeDecodeError, User.DoesNotExist):
                return Response(invalid, status=400)
            if not user.has_usable_password() or not default_token_generator.check_token(user, data['token']):
                return Response(invalid, status=400)
            with override('pt-br'):
                form = SetPasswordForm(user, {
                    'new_password1': data['new_password'],
                    'new_password2': data['new_password'],
                })
                if not form.is_valid():
                    raise serializers.ValidationError({'new_password': list(form.errors.get('new_password2', []))})
                form.save()
        return Response({'detail': 'Senha atualizada com sucesso.'})
