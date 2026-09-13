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


class GrowthBreakdownRow(BaseModel):
    key: str
    registrations: int
    verified: int
    activated: int
    wavr: int


class AdminGrowthMetrics(BaseModel):
    week_start: date
    week_end: date
    as_of: str
    total_registrations: int
    verified_residents: int
    activated_verified_residents: int
    activation_rate: float
    wavr: int
    wau: int
    mau: int
    active_compounds: int
    referral_registrations: int
    referral_share: float
    d7_eligible: int
    d7_returned: int
    d7_return_rate: float
    d30_eligible: int
    d30_returned: int
    d30_return_rate: float
    by_source: list[GrowthBreakdownRow]
    by_campaign: list[GrowthBreakdownRow]
    by_platform: list[GrowthBreakdownRow]
    by_compound: list[GrowthBreakdownRow]
