import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { REGIONAL_CONTACTS } from "@/lib/regional-contacts";

export const Route = createFileRoute("/listen")({
  head: () => ({
    meta: [
      { title: "담당자 바로 연결하기 · 말해농" },
      {
        name: "description",
        content: "농지 소재지를 선택하면 해당 지역의 농지은행 대표번호로 바로 연결합니다.",
      },
    ],
  }),
  component: ListenPage,
});

function ListenPage() {
  return (
    <PageShell back="/" className="regional-contact-shell">
      <section className="regional-contact-page" aria-labelledby="regional-contact-title">
        <p className="regional-contact-eyebrow">
          <Phone size={16} aria-hidden="true" />
          담당자 바로 연결하기
        </p>
        <h1 id="regional-contact-title">
          농지가 있는 지역을
          <br />
          선택해 주세요
        </h1>
        <p className="regional-contact-intro">
          지역을 누르면 해당 지역 대표번호로 바로 연결됩니다.
        </p>
        <h2>
          <MapPin size={21} aria-hidden="true" />
          농지 소재지
        </h2>
        <ul className="regional-contact-grid" aria-label="농지 소재지별 대표번호">
          {REGIONAL_CONTACTS.map(({ region, phone }) => (
            <li key={region}>
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="regional-contact-card"
                  aria-label={`${region} 대표번호 ${phone}로 전화 연결`}
                >
                  <span>
                    <strong>{region}</strong>
                    <small>{phone}</small>
                  </span>
                  <Phone size={22} aria-hidden="true" />
                </a>
              ) : (
                <div className="regional-contact-card is-unavailable" aria-disabled="true">
                  <span>
                    <strong>{region}</strong>
                    <small>번호 확인 중</small>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
