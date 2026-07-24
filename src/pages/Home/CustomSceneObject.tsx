import React from 'react';
import { useAssistant, useInlineAssistant } from '@grafana/assistant';
import {
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import {
  Alert,
  Button,
  Combobox,
  Field,
  Input,
  TextArea,
} from '@grafana/ui';

import type { DataSourceRef } from '../../constants';
import { buildPanel } from './panelFactory';
import {
  parsePanelSpecification,
  SUBDETECTORS,
  VISUALIZATION_LABELS,
  VISUALIZATION_TYPES,
  type DetectorMapPart,
  type PanelSpecification,
  type Subdetector,
  type VisualizationType,
} from './panelSpecification';

interface QueryAssistantState extends SceneObjectState {
  request: string;
  preferredVisualization: VisualizationType;
  title: string;
  promql: string;
  unit: string;
  register: string;
  mapSubdetector: Subdetector;
  mapElement: number;
  mapPart: DetectorMapPart;
  mapLevel: 'chip' | 'module';
  validationError: string;
  panelCount: number;
}

const BARREL_PART_OPTIONS: Array<{
  label: string;
  value: DetectorMapPart;
}> = [
  { label: 'Complete', value: 'complete' },
  { label: 'Ladder (+), Z (+)', value: 'ladder+z+' },
  { label: 'Ladder (+), Z (-)', value: 'ladder+z-' },
  { label: 'Ladder (-), Z (+)', value: 'ladder-z+' },
  { label: 'Ladder (-), Z (-)', value: 'ladder-z-' },
];

const RING_PART_OPTIONS: Array<{
  label: string;
  value: DetectorMapPart;
}> = [
  { label: 'Complete', value: 'complete' },
  { label: 'Left, +Z side', value: 'left+z' },
  { label: 'Right, +Z side', value: 'right+z' },
  { label: 'Left, -Z side', value: 'left-z' },
  { label: 'Right, -Z side', value: 'right-z' },
];

const MAP_LEVEL_OPTIONS: Array<{
  value: 'chip' | 'module';
  label: string;
}> = [
  { value: 'module', label: 'Module' },
  { value: 'chip', label: 'Chip' },
];

const SYSTEM_PROMPT = `
Generate one Grafana panel specification for CMSIT RD53 monitoring.

Return only valid JSON with exactly these top-level fields:
{
  "title": "Short panel title",
  "visualization": "timeseries",
  "promql": "One valid PromQL expression",
  "unit": "Display unit",
  "register": "Primary register name or an empty string",
  "detectorMap": null
}

Supported visualization values, in preferred order:
- timeseries
- detector-map
- stat
- gauge
- bar-gauge
- table
- histogram
- bar-chart
- pie-chart

Use the visualization requested by the user interface. Do not return
Markdown, code fences, comments, or explanations.

Available metrics:
- cmsit_monitor_value
- cmsit_monitor_error
- cmsit_monitor_last_update_seconds

Available labels:
- board
- optical_group
- hybrid
- chip
- register
- unit

Physical and virtual registers are both published through
cmsit_monitor_value and are selected with the register label. Do not assume
that a register is unavailable merely because it is not in the examples.

Common corrected units:
- VINA, VDDA, VIND, VDDD: V
- ANA_IN_CURR, ANA_SHUNT_CURR: uA
- DIG_IN_CURR, DIG_SHUNT_CURR: uA
- INTERNAL_NTC_ABS, INTERNAL_NTC_REL: C

Apply dimensional arithmetic:
- V / V is dimensionless: use an empty unit
- V * uA is uW
- V / uA is MOhm
- V - V is V
- uA + uA is uA
- C - C is C

When combining registers, account for register and unit labels. Use PromQL
vector matching such as ignoring(register, unit) when needed. Preserve
board, optical_group, hybrid, and chip unless aggregation was explicitly
requested.

For a detector-map response, detectorMap must be:
{
  "subdetector": "TBPX",
  "element": 3,
  "part": "complete",
  "level": "module"
}

Detector-map rules:
- subdetector is TBPX, TEPX, or TFPX.
- element is the layer for TBPX and disk for TEPX or TFPX.
- TBPX elements are 1 through 4.
- TEPX elements are 1 through 4.
- TFPX elements are 1 through 8.
- TBPX part is complete, ladder+z+, ladder+z-, ladder-z+, or ladder-z-.
- TEPX/TFPX part is complete, left+z, right+z, left-z, or right-z.
- level is chip or module.
- register must contain the mapped register.
- Keep board, optical_group, hybrid, and chip labels in map query results.
- A map query must be suitable for an instant Prometheus query.
- Use min_over_time(metric[window]) > threshold for "constantly above".
- Use max_over_time(metric[window]) > threshold for "ever above".
- Use avg_over_time(metric[window]) for a time-window average.
- Do not aggregate away chip unless the request explicitly requires it.

For non-map panels, detectorMap must be null. The Grafana time picker
controls the displayed interval. Do not invent a different interval unless
the request asks for a rolling window or range-vector calculation.
`.trim();

function visualizationOptions() {
  return VISUALIZATION_TYPES.map((value) => ({
    value,
    label: VISUALIZATION_LABELS[value],
  }));
}

function elementOptions(subdetector: Subdetector) {
  const count =
    subdetector === 'TBPX' ? 4 : subdetector === 'TFPX' ? 8 : 4;
  const prefix = subdetector === 'TBPX' ? 'Layer' : 'Disk';

  return Array.from({ length: count }, (_, index) => ({
    value: index + 1,
    label: `${prefix} ${index + 1}`,
  }));
}

export class CustomSceneObject extends SceneObjectBase<QueryAssistantState> {
  public static Component = CustomSceneObjectRenderer;

  public constructor(
    private readonly panelLayout: SceneFlexLayout,
    private readonly datasource: DataSourceRef
  ) {
    super({
      request: '',
      preferredVisualization: 'timeseries',
      title: '',
      promql: '',
      unit: '',
      register: '',
      mapSubdetector: 'TBPX',
      mapElement: 1,
      mapPart: 'complete',
      mapLevel: 'module',
      validationError: '',
      panelCount: 0,
    });
  }

  public setRequest = (request: string) => {
    this.setState({ request });
  };

  public setPreferredVisualization = (
    preferredVisualization: VisualizationType
  ) => {
    this.setState({ preferredVisualization });
  };

  public setTitle = (title: string) => {
    this.setState({ title });
  };

  public setPromQL = (promql: string) => {
    this.setState({ promql });
  };

  public setUnit = (unit: string) => {
    this.setState({ unit });
  };

  public setRegister = (register: string) => {
    this.setState({ register });
  };

  public setMapSubdetector = (mapSubdetector: Subdetector) => {
    this.setState({
      mapSubdetector,
      mapElement: 1,
      mapPart: 'complete',
    });
  };

  public setMapElement = (mapElement: number) => {
    this.setState({ mapElement });
  };

  public setMapPart = (mapPart: DetectorMapPart) => {
    this.setState({ mapPart });
  };

  public setMapLevel = (mapLevel: 'chip' | 'module') => {
    this.setState({ mapLevel });
  };

  public setValidationError = (validationError: string) => {
    this.setState({ validationError });
  };

  public applySpecification = (specification: PanelSpecification) => {
    const detectorMap = specification.detectorMap;

    this.setState({
      preferredVisualization: specification.visualization,
      title: specification.title,
      promql: specification.promql,
      unit: specification.unit,
      register: specification.register,
      mapSubdetector:
        detectorMap?.subdetector ?? this.state.mapSubdetector,
      mapElement: detectorMap?.element ?? this.state.mapElement,
      mapPart: detectorMap?.part ?? this.state.mapPart,
      mapLevel: detectorMap?.level ?? this.state.mapLevel,
      validationError: '',
    });

    this.addPanel(specification);
  };

  public addCurrentPanel = () => {
    const specification: PanelSpecification = {
      title: this.state.title,
      visualization: this.state.preferredVisualization,
      promql: this.state.promql,
      unit: this.state.unit,
      register: this.state.register,
    };

    if (this.state.preferredVisualization === 'detector-map') {
      specification.detectorMap = {
        subdetector: this.state.mapSubdetector,
        element: this.state.mapElement,
        part: this.state.mapPart,
        level: this.state.mapLevel,
      };
    }

    this.addPanel(specification);
  };

  private addPanel = (specification: PanelSpecification) => {
    if (!specification.title.trim()) {
      this.setValidationError('Panel title cannot be empty.');
      return;
    }

    if (
      !specification.promql.trim() ||
      specification.promql.includes('```') ||
      specification.promql.includes(';')
    ) {
      this.setValidationError('Enter one valid PromQL expression.');
      return;
    }

    if (
      specification.visualization === 'detector-map' &&
      (!specification.register.trim() || !specification.detectorMap)
    ) {
      this.setValidationError(
        'Detector maps require a register and detector-map settings.'
      );
      return;
    }

    try {
      const built = buildPanel(specification, this.datasource);
      const panelItem = new SceneFlexItem({
        minHeight: built.minHeight,
        body: built.panel,
      });

      built.panel.setState({
        headerActions: (
          <PanelHeaderActions
            title={specification.title}
            onResize={(amount) =>
              this.resizePanel(panelItem, amount)
            }
            onRemove={() => this.removePanel(panelItem)}
          />
        ),
      });

      this.panelLayout.setState({
        children: [
          ...this.panelLayout.state.children,
          panelItem,
        ],
      });

      this.setState({
        validationError: '',
        panelCount: this.state.panelCount + 1,
      });
    } catch (error) {
      this.setValidationError(
        error instanceof Error
          ? error.message
          : 'Could not create the requested panel.'
      );
    }
  };

  private resizePanel = (
    panel: SceneFlexItem,
    amount: number
  ) => {
    const currentHeight =
      typeof panel.state.minHeight === 'number'
        ? panel.state.minHeight
        : 420;

    panel.setState({
      minHeight: Math.max(
        260,
        Math.min(1800, currentHeight + amount)
      ),
    });
  };

  private removePanel = (panelToRemove: SceneFlexItem) => {
    this.panelLayout.setState({
      children: this.panelLayout.state.children.filter(
        (panel) => panel !== panelToRemove
      ),
    });

    this.setState({
      panelCount: Math.max(0, this.state.panelCount - 1),
      validationError: '',
    });
  };

  public clearPanels = () => {
    this.panelLayout.setState({ children: [] });
    this.setState({
      panelCount: 0,
      validationError: '',
    });
  };
}

function PanelHeaderActions({
  title,
  onResize,
  onRemove,
}: {
  title: string;
  onResize: (amount: number) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <Button
        icon="minus"
        size="sm"
        variant="secondary"
        aria-label={`Make ${title} shorter`}
        title="Decrease panel height"
        onClick={() => onResize(-160)}
      />
      <Button
        icon="plus"
        size="sm"
        variant="secondary"
        aria-label={`Make ${title} taller`}
        title="Increase panel height"
        onClick={() => onResize(160)}
      />
      <Button
        icon="times"
        size="sm"
        variant="secondary"
        aria-label={`Remove ${title}`}
        title="Remove panel"
        onClick={onRemove}
      />
    </div>
  );
}

function DetectorMapFields({
  model,
  state,
}: {
  model: CustomSceneObject;
  state: QueryAssistantState;
}) {
  const partOptions =
    state.mapSubdetector === 'TBPX'
      ? BARREL_PART_OPTIONS
      : RING_PART_OPTIONS;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
      }}
    >
      <Field label="Mapped register">
        <Input
          value={state.register}
          placeholder="INTERNAL_NTC_REL"
          onChange={(event) =>
            model.setRegister(event.currentTarget.value)
          }
        />
      </Field>

      <Field label="Subdetector">
        <Combobox
          value={state.mapSubdetector}
          options={SUBDETECTORS.map((value) => ({
            value,
            label: value,
          }))}
          onChange={(option) => {
            if (option.value) {
              model.setMapSubdetector(option.value);
            }
          }}
        />
      </Field>

      <Field
        label={
          state.mapSubdetector === 'TBPX' ? 'Layer' : 'Disk'
        }
      >
        <Combobox
          value={state.mapElement}
          options={elementOptions(state.mapSubdetector)}
          onChange={(option) => {
            if (option.value) {
              model.setMapElement(option.value);
            }
          }}
        />
      </Field>

      <Field label="Detector view">
        <Combobox
          value={state.mapPart}
          options={partOptions}
          onChange={(option) => {
            if (option.value) {
              model.setMapPart(option.value);
            }
          }}
        />
      </Field>

      <Field label="Map resolution">
        <Combobox
          value={state.mapLevel}
          options={MAP_LEVEL_OPTIONS}
          onChange={(option) => {
            if (option.value) {
              model.setMapLevel(option.value);
            }
          }}
        />
      </Field>
    </div>
  );
}

function CustomSceneObjectRenderer({
  model,
}: SceneComponentProps<CustomSceneObject>) {
  const state = model.useState();
  const assistant = useAssistant();
  const { generate, isGenerating, error, cancel, reset } =
    useInlineAssistant();

  const generatePanel = async () => {
    if (!state.request.trim()) {
      model.setValidationError(
        'Enter a monitoring request first.'
      );
      return;
    }

    reset();
    model.setValidationError('');

    await generate({
      prompt:
        `${state.request.trim()}\n\n` +
        `Required visualization: ${state.preferredVisualization}`,
      origin: 'atharphy/cmsit-query-assistant/panel',
      agentName: 'cmsit-panel-generator',
      systemPrompt: SYSTEM_PROMPT,

      onComplete: (response) => {
        try {
          const specification =
            parsePanelSpecification(response);

          if (
            specification.visualization !==
            state.preferredVisualization
          ) {
            throw new Error(
              `Assistant returned ${specification.visualization}, but ${state.preferredVisualization} was selected.`
            );
          }

          model.applySpecification(specification);
        } catch (parseError) {
          model.setValidationError(
            parseError instanceof Error
              ? parseError.message
              : 'Could not parse the Assistant response.'
          );
        }
      },

      onError: (generationError) => {
        model.setValidationError(generationError.message);
      },
    });
  };

  return (
    <div style={{ width: '100%', padding: '8px 4px' }}>
      <Field
        label="Monitoring request"
        description="Describe the register, calculation, detector region, threshold, and time condition."
      >
        <TextArea
          value={state.request}
          rows={3}
          placeholder="Example: Which modules in TBPX layer 3 had INTERNAL_NTC_REL constantly above 20 C during the last 2 days?"
          onChange={(event) =>
            model.setRequest(event.currentTarget.value)
          }
        />
      </Field>

      <Field label="Visualization">
        <Combobox
          value={state.preferredVisualization}
          options={visualizationOptions()}
          onChange={(option) => {
            if (option.value) {
              model.setPreferredVisualization(option.value);
            }
          }}
        />
      </Field>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <Button
          onClick={generatePanel}
          disabled={
            isGenerating ||
            assistant.isLoading ||
            !assistant.isAvailable
          }
        >
          {isGenerating
            ? 'Generating...'
            : 'Generate and add panel'}
        </Button>

        {isGenerating && (
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
        )}

        <Button
          variant="secondary"
          onClick={model.clearPanels}
          disabled={state.panelCount === 0}
        >
          Clear all panels
        </Button>
      </div>

      {!assistant.isLoading && !assistant.isAvailable && (
        <Alert title="Grafana Assistant is unavailable">
          Enable and connect Grafana Assistant before generating
          panels.
        </Alert>
      )}

      <Field label="Panel title">
        <Input
          value={state.title}
          onChange={(event) =>
            model.setTitle(event.currentTarget.value)
          }
        />
      </Field>

      <Field label="PromQL">
        <TextArea
          value={state.promql}
          rows={4}
          onChange={(event) =>
            model.setPromQL(event.currentTarget.value)
          }
        />
      </Field>

      <Field
        label="Display unit"
        description="Examples: V, uA, uW, MOhm, C. Leave empty for dimensionless values."
      >
        <Input
          value={state.unit}
          onChange={(event) =>
            model.setUnit(event.currentTarget.value)
          }
        />
      </Field>

      {state.preferredVisualization === 'detector-map' && (
        <DetectorMapFields model={model} state={state} />
      )}

      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <Button
          variant="secondary"
          onClick={model.addCurrentPanel}
          disabled={
            !state.title.trim() || !state.promql.trim()
          }
        >
          Add panel from fields
        </Button>

        <span>Panels: {state.panelCount}</span>
      </div>

      {(state.validationError || error) && (
        <div style={{ marginTop: '12px' }}>
          <Alert title="Panel generation failed">
            {state.validationError || error?.message}
          </Alert>
        </div>
      )}
    </div>
  );
}
