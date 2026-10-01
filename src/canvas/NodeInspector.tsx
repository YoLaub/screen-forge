import { useState } from "react";
import { type Link, addLink, removeLink, updateLink } from "./links";
import type { NodeKind } from "./nodeRecord";
import type { NodeStyle } from "./style";
import StyleSection, { type StyleApplies } from "./StyleSection";

export interface InspectorNode {
  id: string;
  kind: NodeKind;
  /** "Rectangle", "Capture"… */
  typeLabel: string;
  name: string;
  instructions: string;
  links: Link[];
  /** Number of its pin on the canvas, when it has instructions. */
  pin?: number;
  style?: NodeStyle;
  /** Absent for nodes without editable style (captures). */
  styleApplies?: StyleApplies;
  /** Captures: image size in pixels. */
  size?: { width: number; height: number };
  /** Frames: how many elements they contain. */
  childCount?: number;
}

export type InspectorPatch = Partial<Pick<InspectorNode, "name" | "instructions" | "links" | "style">>;

interface Props {
  node: InspectorNode;
  /** Other nodes on the canvas, as link targets. */
  others: { id: string; name: string; type: string }[];
  onChange: (patch: InspectorPatch) => void;
  /** Fold the panel away. */
  onCollapse: () => void;
}

const field = "h-6 min-w-0 rounded-md border border-line bg-panel2 px-[7px] font-mono text-[11px] text-tx outline-none focus:border-acc";

function Section({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 border-t border-line px-3.5 py-3">{children}</div>;
}

export default function NodeInspector({ node, others, onChange, onCollapse }: Props) {
  const [styleOpen, setStyleOpen] = useState(true);
  const target = (id: string) => others.find((o) => o.id === id);

  return (
    <aside className="flex w-[300px] flex-none flex-col overflow-y-auto border-l border-line bg-panel text-xs text-tx">
      <div className="flex flex-col gap-1.5 px-3.5 py-3">
        <div className="flex items-center gap-[7px]">
          <span className="rounded border border-line bg-panel2 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[.06em] text-tx2">
            {node.typeLabel.toUpperCase()}
          </span>
          <span className="flex-1 font-mono text-[10.5px] text-tx3">{node.id.toUpperCase()}</span>
          <button
            title="Hide inspector (⇧⌘H hides both panels)"
            aria-label="Hide inspector"
            onClick={onCollapse}
            className="grid size-[22px] place-items-center rounded-[5px] text-tx3 hover:bg-hover"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <path d="M10 3v10" />
            </svg>
          </button>
          <button
            title="Copy id"
            aria-label="Copy id"
            onClick={() => navigator.clipboard?.writeText(node.id)}
            className="grid size-[22px] place-items-center rounded-[5px] text-tx3 hover:bg-hover"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
              <path d="M3 10.5V3.8C3 3.3 3.3 3 3.8 3h6.7" />
            </svg>
          </button>
        </div>
        <input
          aria-label="Name"
          value={node.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="-mx-[7px] rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-semibold text-tx outline-none hover:border-line2 focus:border-acc focus:bg-panel2"
        />
      </div>

      <div className="px-3 pb-3.5">
        <div className="flex flex-col gap-2 rounded-[11px] border border-ag-line bg-ag-soft px-2.5 pt-2.5 pb-2">
          <div className="flex items-center gap-[7px] px-0.5">
            <span className="size-2 flex-none rotate-45 bg-ag" />
            <label htmlFor="sf-instructions" className="flex-1 font-semibold text-ag">
              Instructions for the agent
            </label>
            {node.pin && (
              <span
                title={`Pin ${node.pin} on the canvas`}
                className="grid h-[18px] min-w-[18px] place-items-center rounded-[9px_9px_9px_3px] bg-ag px-1 text-[10px] font-semibold text-ag-tx"
              >
                {node.pin}
              </span>
            )}
          </div>
          <textarea
            id="sf-instructions"
            rows={7}
            value={node.instructions}
            placeholder="What should the agent do with this element?"
            onChange={(e) => onChange({ instructions: e.target.value })}
            // Cmd+Enter leaves the field, keeping the text (decision 2026-09-30).
            onKeyDown={(e) => e.key === "Enter" && e.metaKey && e.currentTarget.blur()}
            className="min-h-[110px] w-full resize-y rounded-lg border border-line2 bg-panel px-2.5 py-[9px] text-[12.5px] leading-[1.55] text-tx outline-none focus:border-ag"
          />
          <div className="flex items-center gap-1.5 px-0.5 text-[10.5px] leading-snug text-tx3">
            <span className="flex-1">Sent with the image, position, style and links.</span>
            <span className="rounded border border-line2 px-1 py-px font-mono text-[10px]">⌘↵</span>
          </div>
        </div>
      </div>

      <Section>
        <div className="flex items-center gap-1.5">
          <span className="flex-1 font-semibold">Links</span>
          <span className="text-[11px] text-tx3">{node.links.length ? node.links.length : "None yet"}</span>
        </div>
        {node.links.map((link, i) => {
          const to = target(link.target_node);
          const name = to?.name ?? link.target_node;
          return (
            <div key={`${link.target_node}-${i}`} className="flex flex-col gap-[7px] rounded-[9px] border border-line2 p-2">
              <div className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-tx3">
                  <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" />
                </svg>
                <span className="flex-1 font-medium">{name}</span>
                {to && <span className="text-[10.5px] text-tx3">{to.type}</span>}
                <button
                  aria-label={`Remove link to ${name}`}
                  title="Remove link"
                  onClick={() => onChange({ links: removeLink(node.links, i) })}
                  className="grid size-5 place-items-center rounded-[5px] text-tx3 hover:bg-hover"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-[62px_minmax(0,1fr)] items-center gap-x-2 gap-y-[5px] text-[11px] text-tx2">
                <span>Trigger</span>
                <input
                  aria-label={`Trigger of link to ${name}`}
                  className={field}
                  placeholder="e.g. onClick"
                  value={link.trigger}
                  onChange={(e) => onChange({ links: updateLink(node.links, i, { trigger: e.target.value }) })}
                />
                <span>Payload</span>
                <input
                  aria-label={`Payload type of link to ${name}`}
                  className={field}
                  placeholder="e.g. ApiResponse<User>"
                  value={link.payload_type}
                  onChange={(e) => onChange({ links: updateLink(node.links, i, { payload_type: e.target.value }) })}
                />
              </div>
            </div>
          );
        })}
        <select
          aria-label="Link to"
          value=""
          onChange={(e) => e.target.value && onChange({ links: addLink(node.links, e.target.value) })}
          className="h-[30px] rounded-lg border border-dashed border-line2 bg-transparent px-2 text-xs font-medium text-tx2"
        >
          <option value="">Link to: Choose a node…</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {`${o.name} · ${o.type}`}
            </option>
          ))}
        </select>
      </Section>

      {node.styleApplies && (
        <Section>
          <button
            aria-expanded={styleOpen}
            onClick={() => setStyleOpen((open) => !open)}
            className="flex items-center gap-1.5 text-left text-xs font-semibold text-tx"
          >
            <span className="flex-1">Style</span>
            <svg width="9" height="9" viewBox="0 0 8 8" className={`text-tx3 ${styleOpen ? "" : "-rotate-90"}`}>
              <path d="M1.5 2.8L4 5.3l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
          {styleOpen && <StyleSection style={node.style ?? {}} applies={node.styleApplies} onStyle={(style) => onChange({ style })} />}
        </Section>
      )}

      {node.kind === "capture" && (
        <Section>
          <div className="grid grid-cols-[78px_minmax(0,1fr)] gap-2 text-[11.5px] text-tx2">
            <span className="col-span-2 text-xs font-semibold text-tx">Capture</span>
            {node.size && (
              <>
                <span>Size</span>
                <span className="font-mono text-[11px] text-tx">{`${node.size.width} × ${node.size.height}`}</span>
              </>
            )}
            <span className="col-span-2 text-[11px] leading-[1.45] text-tx3">Captures have no style. Press C to cut a piece out.</span>
          </div>
        </Section>
      )}

      {node.kind === "frame" && node.childCount !== undefined && (
        <Section>
          <span className="text-xs font-semibold">Frame</span>
          <span className="text-[11.5px] leading-[1.45] text-tx2">
            {`Contains ${node.childCount} elements. Moving the frame moves its content.`}
          </span>
        </Section>
      )}
    </aside>
  );
}
