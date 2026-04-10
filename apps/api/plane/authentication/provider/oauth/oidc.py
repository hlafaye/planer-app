# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Planer custom: Generic OIDC provider for Authentik SSO

import os
from datetime import datetime
from urllib.parse import urlencode

import pytz

from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value
from plane.authentication.adapter.error import (
    AuthenticationException,
    AUTHENTICATION_ERROR_CODES,
)


class OIDCProvider(OauthAdapter):
    provider = "oidc"
    scope = "openid profile email"

    def __init__(self, request, code=None, state=None, callback=None):
        OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_HOST = get_configuration_value(
            [
                {
                    "key": "OIDC_CLIENT_ID",
                    "default": os.environ.get("OIDC_CLIENT_ID"),
                },
                {
                    "key": "OIDC_CLIENT_SECRET",
                    "default": os.environ.get("OIDC_CLIENT_SECRET"),
                },
                {
                    "key": "OIDC_HOST",
                    "default": os.environ.get(
                        "OIDC_HOST", "https://auth.parsight.fr"
                    ),
                },
            ]
        )

        OIDC_SLUG = os.environ.get("OIDC_APP_SLUG", "planer")

        if not (OIDC_CLIENT_ID and OIDC_CLIENT_SECRET and OIDC_HOST):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES.get(
                    "GITLAB_NOT_CONFIGURED", "OAUTH_NOT_CONFIGURED"
                ),
                error_message="OIDC_NOT_CONFIGURED",
            )

        self.host = OIDC_HOST
        # Internal URL for server-to-server calls (bypass Cloudflare)
        internal_host = os.environ.get(
            "OIDC_INTERNAL_HOST", "http://authentik-server:9000"
        )
        self.token_url = f"{internal_host}/application/o/token/"
        self.userinfo_url = f"{internal_host}/application/o/userinfo/"

        client_id = OIDC_CLIENT_ID
        client_secret = OIDC_CLIENT_SECRET

        redirect_uri = f"""{"https" if request.is_secure() else "http"}://{request.get_host()}/auth/oidc/callback/"""
        url_params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": self.scope,
            "state": state,
        }
        auth_url = f"{self.host}/application/o/authorize/?{urlencode(url_params)}"
        super().__init__(
            request,
            self.provider,
            client_id,
            self.scope,
            redirect_uri,
            auth_url,
            self.token_url,
            self.userinfo_url,
            client_secret,
            code,
            callback=callback,
        )

    def set_token_data(self):
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": self.code,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        token_response = self.get_user_token(
            data=data, headers={"Accept": "application/json"}
        )
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "access_token_expired_at": (
                    datetime.fromtimestamp(
                        token_response.get("created_at", 0)
                        + token_response.get("expires_in", 3600),
                        tz=pytz.utc,
                    )
                    if token_response.get("expires_in")
                    else None
                ),
                "refresh_token_expired_at": None,
                "id_token": token_response.get("id_token", ""),
            }
        )

    def set_user_data(self):
        user_info_response = self.get_user_response()
        email = user_info_response.get("email")
        name = user_info_response.get("name", "")
        parts = name.split(" ", 1) if name else ["", ""]
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""
        super().set_user_data(
            {
                "email": email,
                "user": {
                    "provider_id": user_info_response.get("sub"),
                    "email": email,
                    "avatar": user_info_response.get("picture", ""),
                    "first_name": first_name
                    or user_info_response.get("given_name", ""),
                    "last_name": last_name
                    or user_info_response.get("family_name", ""),
                    "is_password_autoset": True,
                },
            }
        )
