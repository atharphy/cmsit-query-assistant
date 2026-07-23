import React from 'react';
import { useAssistant, useInlineAssistant } from '@grafana/assistant';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
} from '@grafana/scenes';
import { Alert, Button, Field, Input, TextArea } from '@grafana/ui';

import type { DataSourceRef } from '../../constants';

interface QueryAssistantState extends SceneObjectState {
  request: string;
  title: string;
  promql: string;
  unit: string;
  validationError: string;
  panelCount: number;
}

interface PanelSpecification {
  title: string;
  promql: string;
  unit: string;
}

const SYSTEM_PROMPT = `
Generate a Grafana panel specification for CMSIT RD53 monitoring.

Return only valid JSON with exactly this structure:
{
  "title": "Short panel title",
  "promql": "One valid PromQL expression",
  "unit": "Display unit"
}

Do not return Markdown, code fences, comments, or explanations.

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

Corrected physical units normally include:
- VINA, VDDA, VIND, VDDD: V
- ANA_IN_CURR, ANA_SHUNT_CURR: uA
- DIG_IN_CURR, DIG_SHUNT_CURR: uA
- INTERNAL_NTC_ABS, INTERNAL_NTC_REL: degC

Apply dimensional arithmetic:
- V / V is dimensionless: use an empty unit
- V * uA is uW
- V / uA is MOhm
- V - V is V
- uA + uA is uA
- degC - degC is degC

When combining registers, account for the register and unit labels.
Use PromQL vector matching such as ignoring(register, unit) when needed.

The Grafana time picker controls the displayed interval. Do not invent a
different time interval unless the request explicitly asks for a rolling
window or a range-vector calculation.

Preserve board, optical_group, hybrid, and chip labels unless the user
explicitly requests aggregation across one or more of them.
`.trim();

function removeCodeFences(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseSpecification(value: string): PanelSpecification {
  const parsed: unknown = JSON.parse(removeCodeFences(value));

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Assistant response is not a JSON object.');
  }

  const result = parsed as Record<string, unknown>;

  if (typeof result.title !== 'string' || !result.title.trim()) {
    throw new Error('Assistant response is missing a panel title.');
  }

  if (typeof result.promql !== 'string' || !result.promql.trim()) {
    throw new Error('Assistant response is missing PromQL.');
  }

  if (typeof result.unit !== 'string') {
    throw new Error('Assistant response is missing a unit field.');
  }

  return {
    title: result.title.trim(),
    promql: result.promql.trim(),
    unit: result.unit.trim(),
  };
}

export class CustomSceneObject extends SceneObjectBase<QueryAssistantState> {
  public static Component = CustomSceneObjectRenderer;

  public constructor(
    private readonly panelLayout: SceneFlexLayout,
    private readonly datasource: DataSourceRef
  ) {
    super({
      request: '',
      title: '',
      promql: '',
      unit: '',
      validationError: '',
      panelCount: 0,
    });
  }

  public setRequest = (request: string) => {
    this.setState({ request });
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

  public setValidationError = (validationError: string) => {
    this.setState({ validationError });
  };

  public applySpecification = (specification: PanelSpecification) => {
    this.setState({
      title: specification.title,
      promql: specification.promql,
      unit: specification.unit,
      validationError: '',
    });

    this.addPanel(specification);
  };

  public addCurrentPanel = () => {
    this.addPanel({
      title: this.state.title,
      promql: this.state.promql,
      unit: this.state.unit,
    });
  };

  private addPanel = (specification: PanelSpecification) => {
    const title = specification.title.trim();
    const promql = specification.promql.trim();
    const unit = specification.unit.trim();

    if (!title) {
      this.setValidationError('Panel title cannot be empty.');
      return;
    }

    if (!promql || promql.includes('```') || promql.includes(';')) {
      this.setValidationError('Enter one valid PromQL expression.');
      return;
    }

    const queryRunner = new SceneQueryRunner({
      datasource: this.datasource,
      queries: [
        {
          refId: 'A',
          datasource: this.datasource,
          expr: promql,
          range: true,
          instant: false,
          legendFormat:
            '{{register}} board={{board}} hybrid={{hybrid}} chip={{chip}} {{unit}}',
        },
      ],
      maxDataPoints: 1000,
    });

    const panelBuilder = PanelBuilders.timeseries()
      .setTitle(title)
      .setData(queryRunner);

    if (unit && unit.toLowerCase() !== 'dimensionless') {
      panelBuilder.setUnit(`suffix:${unit}`);
    }

    const panel = panelBuilder.build();

    const panelItem = new SceneFlexItem({
      minHeight: 420,
      body: panel,
    });

    panel.setState({
      headerActions: (
        <Button
          icon="times"
          size="sm"
          variant="secondary"
          aria-label={`Remove ${title}`}
          title="Remove panel"
          onClick={() => this.removePanel(panelItem)}
        />
      ),
    });

    this.panelLayout.setState({
      children: [...this.panelLayout.state.children, panelItem],
    });

    this.setState({
      validationError: '',
      panelCount: this.state.panelCount + 1,
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

function CustomSceneObjectRenderer({
  model,
}: SceneComponentProps<CustomSceneObject>) {
  const state = model.useState();
  const assistant = useAssistant();
  const { generate, isGenerating, error, cancel, reset } =
    useInlineAssistant();

  const generatePanel = async () => {
    if (!state.request.trim()) {
      model.setValidationError('Enter a monitoring request first.');
      return;
    }

    reset();
    model.setValidationError('');

    await generate({
      prompt: state.request.trim(),
      origin: 'atharphy/cmsit-query-assistant/panel',
      agentName: 'cmsit-panel-generator',
      systemPrompt: SYSTEM_PROMPT,

      onComplete: (response) => {
        try {
          model.applySpecification(parseSpecification(response));
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
        description="Describe the panel, aggregation, registers, and time calculation."
      >
        <TextArea
          value={state.request}
          rows={3}
          placeholder="Example: Plot VINA divided by VDDA for each chip"
          onChange={(event) =>
            model.setRequest(event.currentTarget.value)
          }
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
          {isGenerating ? 'Generating...' : 'Generate and add panel'}
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
          Enable and connect Grafana Assistant before generating panels.
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
        description="Examples: V, uA, uW, MOhm, degC. Leave empty for dimensionless values."
      >
        <Input
          value={state.unit}
          onChange={(event) =>
            model.setUnit(event.currentTarget.value)
          }
        />
      </Field>

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
          disabled={!state.title.trim() || !state.promql.trim()}
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
