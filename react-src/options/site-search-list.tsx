import { useRef, useState } from 'react';
import {
  createReactRootController,
  type ReactRootController
} from './root-controller';
import {
  getAsyncErrorMessage,
  useExclusiveAsyncAction
} from '../shared/use-exclusive-async-action';
import { InlinePopconfirm } from './inline-popconfirm';
import { InfoButton } from './info-button';
import { useSegmentedIndicator } from '../shared/segmented-indicator';
import { BusyLabel } from '../shared/busy-label';
import { ReorderButtons, type ReorderCopyModel } from './reorder-buttons';

export type SiteSearchProviderCategory = 'site' | 'searchEngine';

export interface SiteSearchProviderCategoryCopyModel {
  categoryLabel: string;
  searchEngineCategoryLabel: string;
  siteCategoryLabel: string;
}

export interface SiteSearchProviderItemModel {
  aliasesText: string;
  badgeText: string;
  category: SiteSearchProviderCategory;
  duplicateLabel?: string;
  duplicateTemplate?: string;
  duplicateTooltip?: string;
  iconUrl?: string;
  id: string;
  isBuiltin: boolean;
  key: string;
  meta: string;
  name: string;
  normalizedTemplate: string;
  secondaryBadgeText?: string;
  template: string;
  templateEditable: boolean;
}

export interface SiteSearchListCopyModel
  extends SiteSearchProviderCategoryCopyModel {
  aliasLabel: string;
  aliasPlaceholder: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmMessage: string;
  confirmMessageKey: string;
  editLabel: string;
  keyLabel: string;
  keyPlaceholder: string;
  nameLabel: string;
  namePlaceholder: string;
  removeLabel: string;
  saveLabel: string;
  templateHelp: string;
  templateLabel: string;
}

export interface SiteSearchListRenderModel {
  copy: SiteSearchListCopyModel;
  items: SiteSearchProviderItemModel[];
  placeholder: string;
  reorder?: ReorderCopyModel;
}

export interface SiteSearchProviderDraft {
  aliases: string;
  category: SiteSearchProviderCategory;
  key: string;
  name: string;
  template: string;
}

export function SiteSearchProviderCategoryControl({
  category,
  copy,
  onChange
}: {
  category: SiteSearchProviderCategory;
  copy: SiteSearchProviderCategoryCopyModel;
  onChange(category: SiteSearchProviderCategory): void;
}) {
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useSegmentedIndicator(
    indicatorRef,
    `${category}\u0002${copy.siteCategoryLabel}\u0002${copy.searchEngineCategoryLabel}`
  );
  return (
    <div
      aria-label={copy.categoryLabel}
      className="_x_extension_theme_picker_2024_unique_ _x_extension_inline_tabs_2024_unique_ _x_extension_site_search_category_tabs_2026_unique_"
      role="group"
    >
      <span
        aria-hidden="true"
        className="_x_extension_theme_indicator_2024_unique_"
        data-ready="false"
        ref={indicatorRef}
      />
      <button
        aria-pressed={category === 'site'}
        className="_x_extension_theme_option_2024_unique_"
        data-active={category === 'site' ? 'true' : 'false'}
        data-site-search-category="site"
        onClick={() => onChange('site')}
        type="button"
      >
        {copy.siteCategoryLabel}
      </button>
      <button
        aria-pressed={category === 'searchEngine'}
        className="_x_extension_theme_option_2024_unique_"
        data-active={category === 'searchEngine' ? 'true' : 'false'}
        data-site-search-category="searchEngine"
        onClick={() => onChange('searchEngine')}
        type="button"
      >
        {copy.searchEngineCategoryLabel}
      </button>
    </div>
  );
}

export interface SiteSearchSaveResult {
  error?: string;
  ok: boolean;
}

export interface SiteSearchListControllerOptions {
  kind: string;
  onLocateDuplicate(template: string): void;
  // Present on lists the reader can order; rows then drag and show move buttons.
  onMove?(fromIndex: number, toIndex: number): void;
  onRemove(key: string, isBuiltin: boolean): void | Promise<void>;
  onSave(
    key: string,
    isBuiltin: boolean,
    draft: SiteSearchProviderDraft
  ): SiteSearchSaveResult | Promise<SiteSearchSaveResult>;
}

export type SiteSearchListController =
  ReactRootController<SiteSearchListRenderModel>;

function RequiredLabel({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <label className="_x_extension_shortcut_label_2024_unique_">
      <span>{children}</span>
      <span className="_x_extension_shortcut_required_2024_unique_">*</span>
    </label>
  );
}

function ProviderEditor({
  copy,
  item,
  onCancel,
  onSave
}: {
  copy: SiteSearchListCopyModel;
  item: SiteSearchProviderItemModel;
  onCancel(): void;
  onSave(
    key: string,
    isBuiltin: boolean,
    draft: SiteSearchProviderDraft
  ): SiteSearchSaveResult | Promise<SiteSearchSaveResult>;
}) {
  const [draft, setDraft] = useState<SiteSearchProviderDraft>({
    aliases: item.aliasesText,
    category: item.category,
    key: item.key,
    name: item.name,
    template: item.template
  });
  const [error, setError] = useState('');
  const saveAction = useExclusiveAsyncAction(onSave);
  const saving = saveAction.pending;

  const updateDraft = (field: keyof SiteSearchProviderDraft, value: string) => {
    setError('');
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

  return (
    <div className="_x_extension_shortcut_editor_2024_unique_">
      <div className="_x_extension_shortcut_field_2024_unique_">
        <div className="_x_extension_shortcut_label_row_2024_unique_">
          <RequiredLabel>{copy.templateLabel}</RequiredLabel>
          <InfoButton tooltip={copy.templateHelp} />
        </div>
        <input
          className="_x_extension_shortcut_input_2024_unique_"
          data-provider-field="template"
          disabled={!item.templateEditable}
          onChange={(event) => updateDraft('template', event.currentTarget.value)}
          value={draft.template}
        />
      </div>
      <div className="_x_extension_shortcut_field_2024_unique_">
        <RequiredLabel>{copy.keyLabel}</RequiredLabel>
        <input
          className="_x_extension_shortcut_input_2024_unique_"
          data-provider-field="key"
          onChange={(event) => updateDraft('key', event.currentTarget.value)}
          placeholder={copy.keyPlaceholder}
          value={draft.key}
        />
      </div>
      <div className="_x_extension_shortcut_field_2024_unique_">
        <label className="_x_extension_shortcut_label_2024_unique_">
          {copy.nameLabel}
        </label>
        <input
          className="_x_extension_shortcut_input_2024_unique_"
          data-provider-field="name"
          onChange={(event) => updateDraft('name', event.currentTarget.value)}
          placeholder={copy.namePlaceholder}
          value={draft.name}
        />
      </div>
      <div className="_x_extension_shortcut_field_2024_unique_">
        <RequiredLabel>{copy.aliasLabel}</RequiredLabel>
        <input
          className="_x_extension_shortcut_input_2024_unique_"
          data-provider-field="aliases"
          onChange={(event) => updateDraft('aliases', event.currentTarget.value)}
          placeholder={copy.aliasPlaceholder}
          value={draft.aliases}
        />
      </div>
      {!item.isBuiltin ? (
        <div className="_x_extension_shortcut_field_2024_unique_">
          <div className="_x_extension_shortcut_label_2024_unique_">
            {copy.categoryLabel}
          </div>
          <SiteSearchProviderCategoryControl
            category={draft.category}
            copy={copy}
            onChange={(category) => updateDraft('category', category)}
          />
        </div>
      ) : null}
      <div className="_x_extension_shortcut_editor_actions_2024_unique_">
        <button
          className="_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_secondary_2024_unique_"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          {copy.cancelLabel}
        </button>
        <button
          aria-busy={saving}
          className="_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_submit_primary_2024_unique_ _x_extension_shortcut_save_2024_unique_"
          disabled={saving}
          onClick={async () => {
            const outcome = await saveAction.run(
              item.key,
              item.isBuiltin,
              draft
            );
            if (outcome.status === 'skipped') {
              return;
            }
            if (outcome.status === 'rejected') {
              setError(getAsyncErrorMessage(outcome.error));
              return;
            }
            const result = outcome.value;
            if (result.ok) {
              onCancel();
              return;
            }
            setError(result.error || '');
          }}
          type="button"
        >
          <BusyLabel busy={saving}>{copy.saveLabel}</BusyLabel>
        </button>
      </div>
      <div
        className="_x_extension_shortcut_error_2024_unique_"
        style={{ display: error ? 'block' : 'none' }}
      >
        {error}
      </div>
    </div>
  );
}

function SiteSearchList({
  model,
  options
}: {
  model: SiteSearchListRenderModel;
  options: SiteSearchListControllerOptions;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (model.items.length === 0) {
    return model.placeholder ? (
      <div className="_x_extension_settings_placeholder_2024_unique_">
        {model.placeholder}
      </div>
    ) : null;
  }

  const onMove = model.reorder ? options.onMove : undefined;
  return (
    <>
      {model.items.map((item, index) => {
        const expanded = expandedId === item.id;
        return (
          <div
            className="_x_extension_shortcut_item_2024_unique_"
            data-expanded={expanded ? 'true' : 'false'}
            data-key={item.key}
            data-provider-category={item.category}
            data-provider-id={item.id}
            data-sortable={onMove && model.items.length > 1 ? 'true' : undefined}
            data-template={item.normalizedTemplate}
            data-type={item.isBuiltin ? 'builtin' : 'custom'}
            key={item.id}
          >
            <div className="_x_extension_shortcut_item_header_2024_unique_">
              <div className="_x_extension_shortcut_item_info_2024_unique_">
                <div className="_x_extension_shortcut_item_title_2024_unique_">
                  <div className="_x_extension_shortcut_badge_2024_unique_">
                    {item.badgeText}
                  </div>
                  {item.secondaryBadgeText ? (
                    <div
                      className="_x_extension_shortcut_badge_2024_unique_"
                      data-badge-kind="secondary"
                    >
                      {item.secondaryBadgeText}
                    </div>
                  ) : null}
                  {item.iconUrl ? (
                    <img
                      alt=""
                      className="_x_extension_shortcut_item_icon_2024_unique_"
                      decoding="async"
                      loading="lazy"
                      onError={(event) => event.currentTarget.remove()}
                      referrerPolicy="no-referrer"
                      src={item.iconUrl}
                    />
                  ) : null}
                  {item.duplicateTemplate ? (
                    <button
                      aria-label={item.duplicateTooltip}
                      className="_x_extension_shortcut_badge_2024_unique_ _x_extension_shortcut_badge_warn_2024_unique_"
                      data-template={item.duplicateTemplate}
                      data-tooltip={item.duplicateTooltip}
                      onClick={(event) => {
                        event.stopPropagation();
                        options.onLocateDuplicate(item.duplicateTemplate || '');
                      }}
                      type="button"
                    >
                      <i aria-hidden="true" className="ri-icon ri-size-12 ri-information-line" />
                      {item.duplicateLabel}
                    </button>
                  ) : null}
                  <span>{item.name}</span>
                </div>
                <div className="_x_extension_shortcut_item_meta_2024_unique_">
                  {item.meta}
                </div>
              </div>
              <div className="_x_extension_shortcut_item_actions_2024_unique_">
                {model.reorder && onMove ? (
                  <ReorderButtons
                    copy={model.reorder}
                    index={index}
                    onMove={onMove}
                    total={model.items.length}
                  />
                ) : null}
                <button
                  aria-label={model.copy.editLabel}
                  className="_x_extension_shortcut_edit_2024_unique_"
                  data-edit-key={item.key}
                  data-edit-type={item.isBuiltin ? 'builtin' : 'custom'}
                  onClick={(event) => {
                    event.stopPropagation();
                    setExpandedId((value) => value === item.id ? null : item.id);
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
                  onConfirm={() => options.onRemove(item.key, item.isBuiltin)}
                  triggerAriaLabel={model.copy.removeLabel}
                  triggerClassName="_x_extension_shortcut_remove_2024_unique_"
                  triggerIconClass="ri-icon ri-size-14 ri-delete-bin-4-line"
                />
              </div>
            </div>
            <ProviderEditor
              copy={model.copy}
              item={item}
              onCancel={() => setExpandedId(null)}
              onSave={options.onSave}
            />
          </div>
        );
      })}
    </>
  );
}

export function createSiteSearchListController(
  host: HTMLElement | null,
  options: SiteSearchListControllerOptions
): SiteSearchListController {
  if (host) {
    host.dataset.reactIsland = 'options-site-search-list';
    host.dataset.providerKind = options.kind;
  }
  return createReactRootController(
    host,
    (model: SiteSearchListRenderModel) => (
      <SiteSearchList model={model} options={options} />
    )
  );
}

export function createSiteSearchListApi() {
  return Object.freeze({
    implementation: 'react',
    createSiteSearchListController
  });
}
