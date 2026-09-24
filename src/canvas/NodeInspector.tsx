import { type Link, addLink, removeLink, updateLink } from "./links";
import type { NodeKind } from "./nodeRecord";
import type { NodeStyle } from "./style";
import StyleSection, { type StyleApplies } from "./StyleSection";

export interface InspectorNode {
  id: string;
  kind: NodeKind;
  name: string;
  instructions: string;
  links: Link[];
  style?: NodeStyle;
  /** Absent for nodes without editable style (captures). */
  styleApplies?: StyleApplies;
}

export type InspectorPatch = Partial<Pick<InspectorNode, "name" | "instructions" | "links" | "style">>;

interface Props {
  node: InspectorNode;
  /** Other nodes on the canvas, as link targets. */
  others: { id: string; name: string }[];
  onChange: (patch: InspectorPatch) => void;
}

const input =
  "w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-500 focus:outline-none";

export default function NodeInspector({ node, others, onChange }: Props) {
  const nameOf = (id: string) => others.find((o) => o.id === id)?.name ?? id;

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-neutral-200 bg-white p-3 text-sm">
      <div className="text-xs uppercase tracking-wide text-neutral-400">
        {{ capture: "Capture", vector_drawing: "Drawing", frame: "Frame" }[node.kind]} · {node.id}
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">Name</span>
        <input className={input} value={node.name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-neutral-700">Instructions for the agent</span>
        <textarea
          className={`${input} min-h-32 resize-y`}
          value={node.instructions}
          placeholder="What should the agent do with this element?"
          onChange={(e) => onChange({ instructions: e.target.value })}
        />
      </label>

      {node.styleApplies && (
        <StyleSection style={node.style ?? {}} applies={node.styleApplies} onStyle={(style) => onChange({ style })} />
      )}

      <section className="flex flex-col gap-2">
        <span className="font-medium text-neutral-700">Links</span>
        {node.links.map((link, i) => {
          const target = nameOf(link.target_node);
          return (
            <div key={`${link.target_node}-${i}`} className="flex flex-col gap-1 rounded border border-neutral-200 p-2">
              <div className="flex items-center justify-between">
                <span className="text-neutral-700">→ {target}</span>
                <button
                  aria-label={`Remove link to ${target}`}
                  className="text-neutral-400 hover:text-red-600"
                  onClick={() => onChange({ links: removeLink(node.links, i) })}
                >
                  ✕
                </button>
              </div>
              <input
                aria-label={`Trigger of link to ${target}`}
                className={input}
                placeholder="Trigger (e.g. onClick)"
                value={link.trigger}
                onChange={(e) => onChange({ links: updateLink(node.links, i, { trigger: e.target.value }) })}
              />
              <input
                aria-label={`Payload type of link to ${target}`}
                className={input}
                placeholder="Payload type (e.g. ApiResponse<User>)"
                value={link.payload_type}
                onChange={(e) => onChange({ links: updateLink(node.links, i, { payload_type: e.target.value }) })}
              />
            </div>
          );
        })}
        <label className="flex flex-col gap-1">
          <span className="text-neutral-500">Link to</span>
          <select
            className={input}
            value=""
            onChange={(e) => e.target.value && onChange({ links: addLink(node.links, e.target.value) })}
          >
            <option value="">Choose a node…</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </section>
    </aside>
  );
}
