import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createReactRootController,
  type ReactRootController
} from './root-controller';
import { InlinePopconfirm } from './inline-popconfirm';
import {
  getAsyncErrorMessage,
  useExclusiveAsyncAction
} from '../shared/use-exclusive-async-action';
import { BusyLabel } from '../shared/busy-label';
import {
  ReorderControls,
  createRowDragHandlers,
  type ReorderCopyModel
} from './reorder-controls';

export interface AggregateSearchProviderOptionModel {
  available: boolean;
  group: string;
  groupLabel: string;
  iconUrl?: string;
  name: string;
  sourceRef: string;
}

export interface AggregateSearchItemModel {
  id: string;
  key: string;
  name: string;
  sourceRefs: string[];
  sourceSummary: string;
}

export interface AggregateSearchCopyModel extends ReorderCopyModel {
  addLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmMessage: string;
  confirmMessageKey: string;
  defaultNameBase: string;
  editLabel: string;
  groupBadge: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyRequiredError: string;
  keySpaceError: string;
  maxSourcesError: string;
  minSourcesError: string;
  nameLabel: string;
  nameRequiredError: string;
  removeLabel: string;
  saveLabel: string;
  selectedCountLabel: string;
  sourcesLabel: string;
  unavailableGroupLabel?: string;
  unavailableSourceLabel?: string;
}

export interface AggregateSearchListRenderModel {
  copy: AggregateSearchCopyModel;
  items: AggregateSearchItemModel[];
  maxKeyLength: number;
  maxNameLength: number;
  maxSourceCount: number;
  minSourceCount: number;
  providers: AggregateSearchProviderOptionModel[];
}

export interface AggregateSearchDraft {
  key: string;
  name: string;
  sourceRefs: string[];
}

export interface AggregateSearchSaveResult {
  error?: string;
  ok: boolean;
}

export interface AggregateSearchListControllerOptions {
  onRemove(id: string): void | Promise<void>;
  onReorder(fromIndex: number, toIndex: number): void;
  onSave(
    id: string | null,
    draft: AggregateSearchDraft
  ): AggregateSearchSaveResult | Promise<AggregateSearchSaveResult>;
}

export type AggregateSearchListController =
  ReactRootController<AggregateSearchListRenderModel>;

type AggregateSearchEditorErrorField = 'key' | 'name' | 'save' | 'sources';

type AggregateSearchFocusTarget =
  | { kind: 'add' }
  | { itemId: string; kind: 'edit' };

function formatCountLabel(template: string, count: number, max: number) {
  return template
    .replace(/\{count\}/g, String(count))
    .replace(/\{max\}/g, String(max));
}

function formatUnavailableSourceLabel(template: string, sourceRef: string) {
  return template.replace(/\{source\}/g, sourceRef);
}

function normalizeAggregateSearchName(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function getNextAggregateSearchDefaultName(
  items: AggregateSearchItemModel[],
  defaultNameBase: string
) {
  const baseName = normalizeAggregateSearchName(defaultNameBase);
  if (!baseName) {
    return '';
  }
  const usedNames = new Set(items.map((item) => (
    normalizeAggregateSearchName(item.name).toLocaleLowerCase()
  )));
  let ordinal = Math.max(1, items.length + 1);
  while (true) {
    const candidate = ordinal === 1 ? baseName : `${baseName} ${ordinal}`;
    if (!usedNames.has(candidate.toLocaleLowerCase())) {
      return candidate;
    }
    ordinal += 1;
  }
}

// The editor stays mounted so it can animate closed like the other cards; each
// open starts again from the saved item, the way a fresh mount used to.
function AggregateSearchEditor({
  appearance = 'item',
  item,
  model,
  onCancel,
  onSave,
  open
}: {
  appearance?: 'form' | 'item';
  item: AggregateSearchItemModel | null;
  model: AggregateSearchListRenderModel;
  onCancel(): void;
  onSave(
    id: string | null,
    draft: AggregateSearchDraft
  ): AggregateSearchSaveResult | Promise<AggregateSearchSaveResult>;
  open: boolean;
}) {
  const getInitialName = () => item
    ? item.name
    : getNextAggregateSearchDefaultName(
      model.items,
      model.copy.defaultNameBase
    );
  const [name, setName] = useState(getInitialName);
  const [key, setKey] = useState(() => item?.key || '');
  const [selected, setSelected] = useState(
    () => new Set(item?.sourceRefs || [])
  );
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<
    AggregateSearchEditorErrorField | null
  >(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(getInitialName());
      setKey(item?.key || '');
      setSelected(new Set(item?.sourceRefs || []));
      setError('');
      setErrorField(null);
    }
  }
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) nameRef.current?.focus(); }, [open]);
  const errorId = useId();
  const keyId = useId();
  const nameId = useId();
  const sourcesId = useId();
  const saveAction = useExclusiveAsyncAction(onSave);
  const saving = saveAction.pending;
  const providerGroups = useMemo(() => {
    const knownSourceRefs = new Set(
      model.providers.map((provider) => provider.sourceRef)
    );
    const unavailableProvider = model.providers.find(
      (provider) => !provider.available
    );
    const missingSelectedProviders = Array.from(selected)
      .filter((sourceRef) => !knownSourceRefs.has(sourceRef))
      .map((sourceRef): AggregateSearchProviderOptionModel => ({
        available: false,
        group: unavailableProvider?.group || 'unavailable',
        groupLabel: model.copy.unavailableGroupLabel
          || unavailableProvider?.groupLabel
          || model.copy.sourcesLabel,
        name: model.copy.unavailableSourceLabel
          ? formatUnavailableSourceLabel(
            model.copy.unavailableSourceLabel,
            sourceRef
          )
          : sourceRef,
        sourceRef
      }));
    const groups = new Map<string, {
      label: string;
      providers: AggregateSearchProviderOptionModel[];
    }>();
    model.providers.concat(missingSelectedProviders).forEach((provider) => {
      const current = groups.get(provider.group) || {
        label: provider.groupLabel,
        providers: []
      };
      current.providers.push(provider);
      groups.set(provider.group, current);
    });
    return Array.from(groups.entries());
  }, [
    model.copy.sourcesLabel,
    model.copy.unavailableGroupLabel,
    model.copy.unavailableSourceLabel,
    model.providers,
    selected
  ]);

  const clearError = () => {
    setError('');
    setErrorField(null);
  };

  const showError = (
    field: AggregateSearchEditorErrorField,
    message: string
  ) => {
    setError(message);
    setErrorField(field);
  };

  const toggleSource = (sourceRef: string, checked: boolean) => {
    clearError();
    if (
      checked
      && !selected.has(sourceRef)
      && selected.size >= model.maxSourceCount
    ) {
      showError('sources', model.copy.maxSourcesError);
      return;
    }
    const next = new Set(selected);
    if (checked) {
      next.add(sourceRef);
    } else {
      next.delete(sourceRef);
    }
    setSelected(next);
  };

  return (
    <div
      className={`${appearance === 'form'
        ? '_x_extension_shortcut_form_fields_2024_unique_'
        : '_x_extension_shortcut_editor_2024_unique_'} _x_extension_aggregate_search_editor_2026_unique_`}
      inert={!open}
    >
      <div className="_x_extension_shortcut_field_2024_unique_">
        <label
          className="_x_extension_shortcut_label_2024_unique_"
          htmlFor={nameId}
        >
          <span>{model.copy.nameLabel}</span>
          <span className="_x_extension_shortcut_required_2024_unique_">*</span>
        </label>
        <input
          aria-describedby={error && errorField === 'name' ? errorId : undefined}
          aria-invalid={errorField === 'name'}
          className="_x_extension_shortcut_input_2024_unique_"
          data-aggregate-field="name"
          disabled={saving}
          id={nameId}
          maxLength={model.maxNameLength}
          onChange={(event) => {
            clearError();
            setName(event.currentTarget.value);
          }}
          ref={nameRef}
          value={name}
        />
      </div>
      <div className="_x_extension_shortcut_field_2024_unique_">
        <label
          className="_x_extension_shortcut_label_2024_unique_"
          htmlFor={keyId}
        >
          <span>{model.copy.keyLabel}</span>
          <span className="_x_extension_shortcut_required_2024_unique_">*</span>
        </label>
        <input
          aria-describedby={error && errorField === 'key' ? errorId : undefined}
          aria-invalid={errorField === 'key'}
          className="_x_extension_shortcut_input_2024_unique_"
          data-aggregate-field="key"
          disabled={saving}
          id={keyId}
          maxLength={model.maxKeyLength}
          onChange={(event) => {
            clearError();
            setKey(event.currentTarget.value);
          }}
          placeholder={model.copy.keyPlaceholder}
          value={key}
        />
      </div>
      <div className="_x_extension_shortcut_field_2024_unique_">
        <div className="_x_extension_aggregate_search_source_header_2026_unique_">
          <div className="_x_extension_shortcut_label_2024_unique_">
            {model.copy.sourcesLabel}
          </div>
          <span className="_x_extension_aggregate_search_count_2026_unique_">
            {formatCountLabel(
              model.copy.selectedCountLabel,
              selected.size,
              model.maxSourceCount
            )}
          </span>
        </div>
        <div
          aria-describedby={error && errorField === 'sources' ? errorId : undefined}
          aria-invalid={errorField === 'sources'}
          className="_x_extension_aggregate_search_sources_2026_unique_"
          id={sourcesId}
        >
          {providerGroups.map(([group, entry]) => (
            <div
              aria-label={entry.label}
              className="_x_extension_aggregate_search_source_group_2026_unique_"
              data-source-group={group}
              key={group}
              role="group"
            >
              <div className="_x_extension_aggregate_search_source_group_label_2026_unique_">
                {entry.label}
              </div>
              <div
                className="_x_extension_checkbox_group_2026_unique_ _x_extension_aggregate_search_source_grid_2026_unique_"
                data-align="start"
              >
                {entry.providers.map((provider) => {
                  const checked = selected.has(provider.sourceRef);
                  const disabled = saving || (!checked && !provider.available);
                  return (
                    <label
                      className="_x_extension_checkbox_2026_unique_ _x_extension_aggregate_search_source_option_2026_unique_"
                      data-available={provider.available ? 'true' : 'false'}
                      data-disabled={disabled ? 'true' : 'false'}
                      key={provider.sourceRef}
                    >
                      <input
                        checked={checked}
                        data-source-ref={provider.sourceRef}
                        disabled={disabled}
                        onChange={(event) => toggleSource(
                          provider.sourceRef,
                          event.currentTarget.checked
                        )}
                        type="checkbox"
                      />
                      {provider.iconUrl ? (
                        <img
                          alt=""
                          className="_x_extension_shortcut_item_icon_2024_unique_"
                          decoding="async"
                          loading="lazy"
                          onError={(event) => event.currentTarget.remove()}
                          referrerPolicy="no-referrer"
                          src={provider.iconUrl}
                        />
                      ) : null}
                      <span>{provider.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="_x_extension_shortcut_editor_actions_2024_unique_">
        <button
          className="_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_secondary_2024_unique_"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          {model.copy.cancelLabel}
        </button>
        <button
          aria-busy={saving}
          className="_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_submit_primary_2024_unique_ _x_extension_shortcut_save_2024_unique_"
          disabled={saving}
          onClick={async () => {
            if (!key.trim()) {
              showError('key', model.copy.keyRequiredError);
              return;
            }
            if (/\s/.test(key.trim())) {
              showError('key', model.copy.keySpaceError);
              return;
            }
            if (!name.trim()) {
              showError('name', model.copy.nameRequiredError);
              return;
            }
            if (selected.size < model.minSourceCount) {
              showError('sources', model.copy.minSourcesError);
              return;
            }
            if (selected.size > model.maxSourceCount) {
              showError('sources', model.copy.maxSourcesError);
              return;
            }
            const outcome = await saveAction.run(item?.id || null, {
              key: key.trim(),
              name: name.trim(),
              sourceRefs: Array.from(selected)
            });
            if (outcome.status === 'skipped') {
              return;
            }
            if (outcome.status === 'rejected') {
              showError('save', getAsyncErrorMessage(outcome.error));
              return;
            }
            if (outcome.value.ok) {
              onCancel();
            } else {
              showError('save', outcome.value.error || '');
            }
          }}
          type="button"
        >
          <BusyLabel busy={saving}>{item ? model.copy.saveLabel : model.copy.addLabel}</BusyLabel>
        </button>
      </div>
      <div
        className="_x_extension_shortcut_error_2024_unique_"
        id={errorId}
        role="alert"
        style={{ display: error ? 'block' : 'none' }}
      >
        {error}
      </div>
    </div>
  );
}

function AggregateSearchList({
  model,
  options
}: {
  model: AggregateSearchListRenderModel;
  options: AggregateSearchListControllerOptions;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<
    AggregateSearchFocusTarget | null
  >(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const editTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragFromIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const adding = editingId === '__new__';

  useLayoutEffect(() => {
    if (!focusTarget) {
      return;
    }
    const requestedTarget = focusTarget.kind === 'edit'
      ? editTriggerRefs.current.get(focusTarget.itemId)
      : addTriggerRef.current;
    const fallbackEditTarget = Array.from(editTriggerRefs.current.values())
      .find((button) => button.isConnected);
    const target = requestedTarget?.isConnected
      ? requestedTarget
      : fallbackEditTarget || addTriggerRef.current;
    target?.focus({ preventScroll: true });
    setFocusTarget(null);
  }, [focusTarget, model.items]);

  const closeEditor = (target: AggregateSearchFocusTarget) => {
    setEditingId(null);
    setFocusTarget(target);
  };

  const getRemovalFocusTarget = (itemId: string): AggregateSearchFocusTarget => {
    const itemIndex = model.items.findIndex((item) => item.id === itemId);
    const adjacentItem = itemIndex >= 0
      ? model.items[itemIndex + 1] || model.items[itemIndex - 1]
      : null;
    return adjacentItem
      ? { itemId: adjacentItem.id, kind: 'edit' }
      : { kind: 'add' };
  };

  return (
    <>
      <div className="_x_extension_shortcut_list_2024_unique_">
        {model.items.map((item, index) => {
          const expanded = editingId === item.id;
          const rowDrag = createRowDragHandlers({
            getFromIndex: () => dragFromIndexRef.current,
            index,
            onReorder: (fromIndex, toIndex) => {
              setDraggingIndex(null);
              options.onReorder(fromIndex, toIndex);
            },
            setFromIndex: (value) => {
              dragFromIndexRef.current = value;
              setDraggingIndex(value);
            }
          });
          return (
            <div
              className="_x_extension_shortcut_item_2024_unique_"
              data-aggregate-id={item.id}
              data-dragging={draggingIndex === index ? 'true' : 'false'}
              data-expanded={expanded ? 'true' : 'false'}
              data-reorder-row="true"
              data-type="aggregate"
              key={item.id}
              onDragEnd={rowDrag.onDragEnd}
              onDragOver={rowDrag.onDragOver}
              onDrop={rowDrag.onDrop}
            >
              <div className="_x_extension_shortcut_item_header_2024_unique_">
                <ReorderControls
                  copy={model.copy}
                  dragStart={rowDrag.onDragStart}
                  index={index}
                  onReorder={(fromIndex, toIndex) => {
                    setDraggingIndex(null);
                    options.onReorder(fromIndex, toIndex);
                  }}
                  total={model.items.length}
                />
                <div className="_x_extension_shortcut_item_info_2024_unique_">
                  <div className="_x_extension_shortcut_item_title_2024_unique_">
                    <div className="_x_extension_shortcut_badge_2024_unique_">
                      {model.copy.groupBadge}
                    </div>
                    <i aria-hidden="true" className="ri-icon ri-size-16 ri-stack-line" />
                    <span>{item.name}</span>
                  </div>
                  <div className="_x_extension_shortcut_item_meta_2024_unique_">
                    {item.key ? `${item.key} · ${item.sourceSummary}` : item.sourceSummary}
                  </div>
                </div>
                <div className="_x_extension_shortcut_item_actions_2024_unique_">
                  <button
                    aria-label={model.copy.editLabel}
                    className="_x_extension_shortcut_edit_2024_unique_"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingId((current) => current === item.id ? null : item.id);
                    }}
                    ref={(button) => {
                      if (button) {
                        editTriggerRefs.current.set(item.id, button);
                      } else {
                        editTriggerRefs.current.delete(item.id);
                      }
                    }}
                    type="button"
                  >
                    <i aria-hidden="true" className="ri-icon ri-size-14 ri-edit-line" />
                  </button>
                  <InlinePopconfirm
                    copy={{
                      cancelLabel: model.copy.cancelLabel,
                      confirmLabel: model.copy.confirmLabel,
                      message: model.copy.confirmMessage,
                      messageKey: model.copy.confirmMessageKey
                    }}
                    onConfirm={async () => {
                      const nextFocusTarget = getRemovalFocusTarget(item.id);
                      await options.onRemove(item.id);
                      setFocusTarget(nextFocusTarget);
                    }}
                    triggerAriaLabel={model.copy.removeLabel}
                    triggerClassName="_x_extension_shortcut_remove_2024_unique_"
                    triggerIconClass="ri-icon ri-size-14 ri-delete-bin-4-line"
                  />
                </div>
              </div>
              <AggregateSearchEditor
                item={item}
                model={model}
                onCancel={() => closeEditor({
                  itemId: item.id,
                  kind: 'edit'
                })}
                onSave={options.onSave}
                open={expanded}
              />
            </div>
          );
        })}
      </div>
      <div
        className="_x_extension_shortcut_form_2024_unique_"
        data-expanded={adding ? 'true' : 'false'}
        data-type="aggregate"
      >
        <div className="_x_extension_shortcut_form_trigger_2024_unique_">
          <button
            aria-expanded={adding}
            className="_x_extension_shortcut_submit_2024_unique_ _x_extension_aggregate_search_add_2026_unique_"
            onClick={() => setEditingId('__new__')}
            ref={addTriggerRef}
            type="button"
          >
            <i aria-hidden="true" className="ri-icon ri-size-14 ri-add-line" />
            <span>{model.copy.addLabel}</span>
          </button>
        </div>
        <AggregateSearchEditor
          appearance="form"
          item={null}
          model={model}
          onCancel={() => closeEditor({ kind: 'add' })}
          onSave={options.onSave}
          open={adding}
        />
      </div>
    </>
  );
}

export function createAggregateSearchListController(
  host: HTMLElement | null,
  options: AggregateSearchListControllerOptions
): AggregateSearchListController {
  if (host) {
    host.dataset.reactIsland = 'options-aggregate-search-list';
  }
  return createReactRootController(
    host,
    (model: AggregateSearchListRenderModel) => (
      <AggregateSearchList model={model} options={options} />
    )
  );
}

export function createAggregateSearchListApi() {
  return Object.freeze({
    implementation: 'react',
    createAggregateSearchListController
  });
}
