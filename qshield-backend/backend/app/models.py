from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import relationship

from backend.app.db import Base

# Valid role values
VALID_ROLES = {"admin", "viewer", "auditor", "itadmin"}


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Role-based access control
    # admin   -> full access
    # viewer  -> read-only (PNB Checker)
    # auditor -> viewer + reports
    # itadmin -> viewer + vulnerability scan + settings
    role = Column(String, default="viewer", nullable=False, server_default="viewer")

    # Increment this to invalidate all active JWTs for the user
    token_version = Column(Integer, default=0, nullable=False, server_default="0")

    # 2FA (TOTP) fields - nullable so existing rows are unaffected
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False, nullable=False, server_default="0")


class TargetScope(Base):
    __tablename__ = "target_scopes"
    __table_args__ = (
        UniqueConstraint("domain", "bounty_platform", name="uq_target_scopes_domain_platform"),
    )

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, nullable=False, index=True)
    bounty_platform = Column(String, nullable=False, index=True)

    discovered_assets = relationship(
        "DiscoveredAsset",
        back_populates="scope",
        cascade="all, delete-orphan",
    )


class DiscoveredAsset(Base):
    __tablename__ = "discovered_assets"
    __table_args__ = (
        UniqueConstraint(
            "scope_id",
            "subdomain",
            "ip",
            name="uq_discovered_assets_scope_subdomain_ip",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    scope_id = Column(
        Integer,
        ForeignKey("target_scopes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subdomain = Column(String, nullable=False, index=True)
    ip = Column(String, nullable=True, index=True)
    ports = Column(Text, nullable=True)
    first_seen = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    last_seen = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    is_new_discovery = Column(Boolean, nullable=False, default=True, server_default="1", index=True)

    scope = relationship("TargetScope", back_populates="discovered_assets")
