from datetime import date

from pydantic import BaseModel


class BetaMetricPoint(BaseModel):
    date: date
    value: int


class AdminBetaMetrics(BaseModel):
    date_from: date
    date_to: date
    total_registered_users: int
    new_users_by_day: list[BetaMetricPoint]
    onboarding_completion_rate: float
    active_users: int
    posts_created: int
    comments_created: int
    searches_performed: int
    business_claims: int
    reports_awaiting_review: int
    invitations_sent: int
    successful_referrals: int
    client_errors: int
