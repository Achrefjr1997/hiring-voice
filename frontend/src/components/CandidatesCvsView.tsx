import { useState } from "react";

interface Candidate {
  name: string;
  email: string;
  skills: string[];
  experience: string;
  linkedInterviews: number;
}

const MOCK_CANDIDATES: Candidate[] = [
  { name: "Ahmed Benali", email: "ahmed@example.com", skills: ["Python", "ML", "NLP"], experience: "4 years", linkedInterviews: 2 },
  { name: "Sarah El Amrani", email: "sarah@example.com", skills: ["React", "TypeScript", "Node"], experience: "6 years", linkedInterviews: 1 },
  { name: "Karim Idrissi", email: "karim@example.com", skills: ["Python", "Django", "SQL"], experience: "3 years", linkedInterviews: 0 },
  { name: "Omar Bennis", email: "omar@example.com", skills: ["Java", "Spring", "AWS"], experience: "5 years", linkedInterviews: 3 },
  { name: "Leila Benkirane", email: "leila@example.com", skills: ["React", "GraphQL", "Docker"], experience: "2 years", linkedInterviews: 0 },
  { name: "Youssef El Fassi", email: "youssef@example.com", skills: ["Python", "FastAPI", "PostgreSQL"], experience: "4 years", linkedInterviews: 1 },
];

export default function CandidatesCvsView() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = MOCK_CANDIDATES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <div className="px-8 py-4 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, email, skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-surface-default border border-border-default rounded-radius-input px-4 py-2.5 text-caption text-text-primary placeholder:text-text-muted outline-none focus:border-accent-gold transition-colors"
        />
        <select className="bg-surface-default border border-border-default rounded-radius-input px-4 py-2.5 text-caption text-text-muted outline-none cursor-pointer">
          <option>All Skills</option>
          <option>Python</option>
          <option>React</option>
          <option>ML</option>
        </select>
        <select className="bg-surface-default border border-border-default rounded-radius-input px-4 py-2.5 text-caption text-text-muted outline-none cursor-pointer">
          <option>All Experience</option>
          <option>&lt; 2 years</option>
          <option>2–5 years</option>
          <option>5+ years</option>
        </select>
      </div>

      <div className="px-8 pb-8">
        <div className="bg-surface-default border border-border-default rounded-radius-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Name</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Email</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Skills</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Experience</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Linked Interviews</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.email} className="border-b border-border-default last:border-b-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-caption text-text-primary">{c.name}</td>
                  <td className="px-4 py-3 text-caption text-text-secondary">{c.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {c.skills.map((s) => (
                        <span key={s} className="bg-white/[0.06] text-text-muted px-2 py-0.5 rounded-radius-pill text-[11px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-caption text-text-primary">{c.experience}</td>
                  <td className="px-4 py-3 text-caption text-text-primary">{c.linkedInterviews}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-[11px] text-accent-gold border border-accent-gold/40 rounded-radius-input px-3 py-1 hover:bg-accent-gold/10 transition-colors">
                        Schedule Interview
                      </button>
                      <button className="text-[11px] text-text-muted border border-border-default rounded-radius-input px-3 py-1 hover:text-text-primary transition-colors">
                        Profile
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-caption text-text-muted">
                    No candidates found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-surface-default border border-border-default rounded-radius-card p-8 w-[480px] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-body font-semibold text-text-primary mb-1">Upload CV</h2>
            <p className="text-caption text-text-muted mb-5">Upload a PDF or DOCX file to auto-extract candidate data.</p>
            <div className="border-2 border-dashed border-border-default rounded-radius-card px-8 py-12 text-center cursor-pointer hover:border-accent-gold/50 hover:bg-accent-gold/[0.02] transition-colors">
              <div className="text-4xl mb-2 text-text-muted">📄</div>
              <p className="text-caption text-text-muted">
                Drag &amp; drop your file here, or{" "}
                <span className="text-accent-gold underline cursor-pointer">browse</span>
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-radius-input text-caption text-text-muted border border-border-default hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button className="px-5 py-2 rounded-radius-input text-caption font-medium bg-accent-gold text-bg-primary hover:brightness-110 transition-all">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
