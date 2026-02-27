import { useState } from 'react';

function daysLeft(deadlineStr) {
  if (!deadlineStr) return null;
  const end = new Date(deadlineStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end - today) / (24 * 60 * 60 * 1000));
  return diff;
}

function formatDeadline(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) {
    return dateStr;
  }
}

/** Priority from days left: Critical (< 30), Medium (30–90), Low (90–180). */
function getDeadlinePriority(days) {
  if (days === null) return null;
  if (days < 30) return 'Critical';
  if (days < 90) return 'Medium';
  if (days <= 180) return 'Low';
  return null;
}

function ParentCard({ parent, opcosCount, deadline, changeId, changeTitle, companies = [], showViewDetails, onAssignTasks }) {
  const [showOpcos, setShowOpcos] = useState(false);
  const days = daysLeft(deadline);
  const isOverdue = days !== null && days < 0;
  const isUrgent = days !== null && days >= 0 && days <= 30;
  const hasOpcos = Array.isArray(companies) && companies.length > 0;
  const priority = getDeadlinePriority(days);

  return (
    <div className="impact-parent-card">
      <div className="impact-parent-card-header">
        <div className="impact-parent-name">{parent}</div>
        {priority && (
          <span className={`impact-priority-badge impact-priority-${priority.toLowerCase()}`}>
            {priority}
          </span>
        )}
      </div>
      <div className="impact-parent-tabs">
        <div className="impact-tab">
          <span className="impact-tab-label">Number of OpCo's affected</span>
          <span className="impact-tab-value">{opcosCount}</span>
        </div>
        <div className="impact-tab">
          <span className="impact-tab-label">Deadline</span>
          <span className="impact-tab-value">{formatDeadline(deadline)}</span>
        </div>
        <div className="impact-tab">
          <span className="impact-tab-label">Days Left</span>
          <span className={`impact-tab-value ${isOverdue ? 'impact-days-overdue' : isUrgent ? 'impact-days-urgent' : ''}`}>
            {days === null ? '—' : isOverdue ? `${Math.abs(days)} days overdue` : `${days} days`}
          </span>
        </div>
      </div>
      <div className="impact-parent-actions">
        {showViewDetails && hasOpcos && (
          <button
            type="button"
            className="impact-btn impact-btn-details"
            onClick={() => setShowOpcos((v) => !v)}
          >
            {showOpcos ? 'Hide Details' : 'View Details'}
          </button>
        )}
        <button type="button" className="impact-btn impact-btn-assign" onClick={() => onAssignTasks(changeId, parent)}>
          Assign Tasks
        </button>
      </div>
      {showViewDetails && showOpcos && hasOpcos && (
        <div className="impact-opcos-table-wrap">
          <table className="impact-opcos-table">
            <thead>
              <tr>
                <th>Affected OpCos under {parent}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((name) => (
                <tr key={name}>
                  <td>{name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TreeNode({ label, children, level, parentCards, changeId, changeTitle, showViewDetails, onViewDetails, onAssignTasks }) {
  const [open, setOpen] = useState(level < 2);
  const hasChildren = Array.isArray(children) && children.length > 0;
  const hasParentCards = Array.isArray(parentCards) && parentCards.length > 0;
  const levelClass = level === 0 ? 'tree-root' : level === 1 ? 'tree-branch' : 'tree-leaf';

  return (
    <li className={`tree-node tree-level-${level} ${levelClass}`}>
      <div
        className="tree-node-label"
        onClick={() => (hasChildren || hasParentCards) && setOpen((o) => !o)}
        role={hasChildren || hasParentCards ? 'button' : undefined}
        aria-expanded={hasChildren || hasParentCards ? open : undefined}
      >
        {(hasChildren || hasParentCards) && (
          <span className="tree-toggle" aria-hidden>
            {open ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && !hasParentCards && <span className="tree-bullet" />}
        <span className="tree-text">{label}</span>
      </div>
      {open && hasParentCards && level === 1 && (
        <div className="impact-parent-cards">
          {parentCards.map((item) => (
            <ParentCard
              key={item.parent}
              parent={item.parent}
              opcosCount={item.opcosCount}
              deadline={item.deadline}
              companies={item.companies}
              changeId={changeId}
              changeTitle={changeTitle}
              showViewDetails={showViewDetails}
              onAssignTasks={onAssignTasks}
            />
          ))}
        </div>
      )}
      {open && hasChildren && (
        <ul className="tree-children">
          {children.map((child, i) => (
            <TreeNode
              key={child.id || i}
              label={child.label}
              children={child.children}
              level={level + 1}
              parentCards={child.parentCards}
              changeId={child.changeId}
              changeTitle={child.changeTitle}
              showViewDetails={showViewDetails}
              onViewDetails={onViewDetails}
              onAssignTasks={onAssignTasks}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Build tree: Framework → Change → Parent holding company. Optional filterParent limits to that parent's cards. */
function buildTree(changes, filterParent) {
  if (!Array.isArray(changes) || changes.length === 0) return [];
  const byFramework = {};
  for (const c of changes) {
    let parents = c.affectedParents && c.affectedParents.length > 0 ? c.affectedParents : [];
    if (filterParent) {
      parents = parents.filter((p) => p.parent === filterParent);
      if (parents.length === 0) continue;
    }
    const changeNode = {
      id: c.id,
      label: `${c.title} (${c.date || ''})`,
      children: null,
      parentCards: parents.map((p) => ({
        parent: p.parent,
        opcosCount: p.opcosCount,
        deadline: c.deadline,
        companies: p.companies || [],
      })),
      changeId: c.id,
      changeTitle: c.title,
    };
    const fw = c.framework || 'Other';
    if (!byFramework[fw]) byFramework[fw] = [];
    byFramework[fw].push(changeNode);
  }
  return Object.entries(byFramework).map(([framework, changeNodes]) => ({
    id: framework,
    label: framework,
    children: changeNodes,
  }));
}

/** OpCo-only view: list of changes affecting the selected OpCo; no View Details. */
function OpCoChangesList({ changes, selectedOpCo }) {
  const list = (changes || []).filter(
    (c) => (c.affectedCompanies || []).includes(selectedOpCo)
  );
  if (list.length === 0) {
    return (
      <p className="changes-tree-empty">No changes affect the selected OpCo in the current period.</p>
    );
  }
  return (
    <div className="opco-changes-list">
      <p className="opco-changes-intro">Changes affecting <strong>{selectedOpCo}</strong>:</p>
      <ul className="opco-changes-ul">
        {list.map((c) => {
          const days = daysLeft(c.deadline);
          const isOverdue = days !== null && days < 0;
          const isUrgent = days !== null && days >= 0 && days <= 30;
          return (
            <li key={c.id} className="opco-change-item">
              <div className="opco-change-title">{c.title}</div>
              <div className="opco-change-meta">
                <span>{c.framework}</span>
                <span>{c.date}</span>
                <span>Deadline: {formatDeadline(c.deadline)}</span>
                <span className={isOverdue ? 'impact-days-overdue' : isUrgent ? 'impact-days-urgent' : ''}>
                  {days !== null ? (isOverdue ? `${Math.abs(days)} days overdue` : `${days} days left`) : '—'}
                </span>
              </div>
              <p className="opco-change-snippet">{c.snippet}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChangesTree({ changes, selectedParent, selectedOpCo, onViewDetails, onAssignTasks }) {
  const handleViewDetails = onViewDetails || (() => {});
  const handleAssignTasks = onAssignTasks || (() => {});
  const showViewDetails = !!selectedParent;

  if (selectedOpCo && !selectedParent) {
    return (
      <section className="changes-tree-section">
        <h3 className="changes-tree-title">Impact: Framework → Change → Parent Holding company</h3>
        <OpCoChangesList changes={changes} selectedOpCo={selectedOpCo} />
      </section>
    );
  }

  const treeData = buildTree(changes, selectedParent || undefined);

  if (treeData.length === 0) {
    return (
      <section className="changes-tree-section">
        <h3 className="changes-tree-title">Impact: Framework → Change → Parent Holding company</h3>
        <p className="changes-tree-empty">
          {selectedParent
            ? `No changes for the selected parent in the current period.`
            : 'Select a framework and time period, then click “Show changes” to see the tree.'}
        </p>
      </section>
    );
  }

  return (
    <section className="changes-tree-section">
      <h3 className="changes-tree-title">Impact: Framework → Change → Parent Holding company</h3>
      <ul className="tree-list">
        {treeData.map((root) => (
          <TreeNode
            key={root.id}
            label={root.label}
            children={root.children}
            level={0}
            parentCards={undefined}
            changeId={undefined}
            changeTitle={undefined}
            showViewDetails={showViewDetails}
            onViewDetails={handleViewDetails}
            onAssignTasks={handleAssignTasks}
          />
        ))}
      </ul>
    </section>
  );
}
